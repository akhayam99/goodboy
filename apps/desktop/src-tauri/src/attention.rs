use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use crate::db::Db;
use crate::workflows::PhaseError;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Kind {
    Error,
    HumanInput,
    Other,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Tone {
    Danger,
    Warning,
}

struct Reason {
    code: &'static str,
    tone: Tone,
    kind: Kind,
}

const REASONS: [Reason; 5] = [
    Reason {
        code: "agent-error",
        tone: Tone::Danger,
        kind: Kind::Error,
    },
    Reason {
        code: "push-failed",
        tone: Tone::Danger,
        kind: Kind::Other,
    },
    Reason {
        code: "open-question",
        tone: Tone::Warning,
        kind: Kind::HumanInput,
    },
    Reason {
        code: "fix-needs-you",
        tone: Tone::Warning,
        kind: Kind::HumanInput,
    },
    Reason {
        code: "ci-failed",
        tone: Tone::Danger,
        kind: Kind::Other,
    },
];

const SESSION_FACTS_SQL: &str = "
    SELECT
      s.workspace_id,
      s.state_kind = 'error',
      s.state_kind IN ('running', 'starting') OR EXISTS (
        SELECT 1 FROM live_agents a
        WHERE a.session_id = s.id AND a.status = 'running'
      ),
      (SELECT COUNT(*) FROM open_questions q
        WHERE q.session_id = s.id AND q.status = 'open'),
      (SELECT COUNT(*) FROM resolve_threads t
        WHERE t.session_id = s.id AND t.state = 'needs_answer'),
      (SELECT COUNT(*) FROM resolve_threads t
        WHERE t.session_id = s.id AND t.state = 'failed'
          AND t.state_reason LIKE 'publication_failed:%'
          AND t.origin_kind != 'diff_comment'),
      EXISTS (
        SELECT 1 FROM mount_pr_links l
        JOIN session_worktrees m ON m.id = l.mount_id
        WHERE m.session_id = s.id AND m.is_attached = 1
          AND (s.active_mount_id IS NULL OR s.active_mount_id = m.id)
          AND l.state NOT IN ('merged', 'closed')
          AND CASE WHEN json_valid(l.snapshot_json)
                THEN json_extract(l.snapshot_json, '$.checks') ELSE NULL END = 'failure'
      ),
      NOT EXISTS (
        SELECT 1 FROM session_worktrees b
        WHERE b.id = s.active_mount_id AND TRIM(b.branch) = ''
      )
    FROM sessions s
    JOIN workspaces w ON w.id = s.workspace_id
    WHERE s.archived_at IS NULL AND s.deleted_at IS NULL AND w.deleted_at IS NULL";

#[derive(Debug, Clone, Default, PartialEq, Eq)]
struct SessionFacts {
    is_errored: bool,
    is_live: bool,
    open_questions: i64,
    fix_needs_you: i64,
    push_failed: i64,
    is_ci_failing: bool,
}

impl SessionFacts {
    fn on_branch_only(self, is_on_branch: bool) -> Self {
        if is_on_branch {
            return self;
        }
        SessionFacts {
            fix_needs_you: 0,
            push_failed: 0,
            is_ci_failing: false,
            ..self
        }
    }

    fn items_of(&self, index: usize) -> i64 {
        match index {
            0 => i64::from(self.is_errored),
            1 => self.push_failed,
            2 => self.open_questions,
            3 => self.fix_needs_you,
            _ => i64::from(self.is_ci_failing),
        }
    }

    fn held(&self) -> Vec<usize> {
        (0..REASONS.len())
            .filter(|index| self.items_of(*index) > 0)
            .collect()
    }

    fn counted(&self) -> Option<Vec<usize>> {
        let held = self.held();
        let winner = held.first().copied()?;
        let blocker = held
            .iter()
            .copied()
            .find(|index| REASONS[*index].kind != Kind::Other);
        let is_attention = match blocker {
            Some(blocker) if blocker == winner || self.is_live => true,
            _ => !self.is_live,
        };
        is_attention.then_some(held)
    }
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceAttentionRow {
    pub workspace_id: String,
    pub count: i64,
    pub tone: &'static str,
    pub reasons: Vec<&'static str>,
}

#[derive(Default)]
struct Tally {
    count: i64,
    has_danger: bool,
    is_held: [bool; REASONS.len()],
}

fn session_facts(conn: &Connection) -> Result<Vec<(String, SessionFacts)>, rusqlite::Error> {
    let mut stmt = conn.prepare(SESSION_FACTS_SQL)?;
    let rows = stmt.query_map([], |row| {
        let facts = SessionFacts {
            is_errored: row.get::<_, i64>(1)? != 0,
            is_live: row.get::<_, i64>(2)? != 0,
            open_questions: row.get(3)?,
            fix_needs_you: row.get(4)?,
            push_failed: row.get(5)?,
            is_ci_failing: row.get::<_, i64>(6)? != 0,
        };
        Ok((
            row.get::<_, String>(0)?,
            facts.on_branch_only(row.get::<_, i64>(7)? != 0),
        ))
    })?;
    rows.collect()
}

fn workspace_attention(conn: &Connection) -> Result<Vec<WorkspaceAttentionRow>, rusqlite::Error> {
    let mut tallies: Vec<(String, Tally)> = Vec::new();
    for (workspace_id, facts) in session_facts(conn)? {
        let Some(held) = facts.counted() else {
            continue;
        };
        let position = match tallies.iter().position(|(id, _)| *id == workspace_id) {
            Some(position) => position,
            None => {
                tallies.push((workspace_id, Tally::default()));
                tallies.len() - 1
            }
        };
        let tally = &mut tallies[position].1;
        tally.count += 1;
        for index in held {
            tally.is_held[index] = true;
            if REASONS[index].tone == Tone::Danger {
                tally.has_danger = true;
            }
        }
    }
    tallies.sort_by(|left, right| left.0.cmp(&right.0));
    Ok(tallies
        .into_iter()
        .map(|(workspace_id, tally)| WorkspaceAttentionRow {
            workspace_id,
            count: tally.count,
            tone: match tally.has_danger {
                true => "danger",
                false => "warning",
            },
            reasons: REASONS
                .iter()
                .enumerate()
                .filter(|(index, _)| tally.is_held[*index])
                .map(|(_, reason)| reason.code)
                .collect(),
        })
        .collect())
}

#[tauri::command]
pub async fn workspaces_attention(
    state: State<'_, Db>,
) -> Result<Vec<WorkspaceAttentionRow>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    workspace_attention(&conn).map_err(PhaseError::Db)
}

#[cfg(test)]
mod tests;
