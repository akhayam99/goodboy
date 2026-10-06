use super::error::WorktreeError;
use super::git::{git, is_ancestor, resolve_commit, short_of};
use super::slug::sanitize_slug;
use super::status::read_working_tree;
use super::types::{
    GitWorkingTree, IntegrateCandidateArgs, IntegratedCandidate, QuarantineCandidateArgs,
    QuarantinedCandidate, SplitCandidate, SplitCandidatePick, SplitCandidatesArgs,
};
use std::path::{Path, PathBuf};

fn candidate_ref(candidate_id: &str) -> String {
    format!("refs/goodboy/candidates/{}", sanitize_slug(candidate_id))
}

fn journal_path(cwd: &Path, candidate_id: &str) -> Result<PathBuf, WorktreeError> {
    let git_dir = git(cwd, &["rev-parse", "--absolute-git-dir"])?;
    let dir = Path::new(git_dir.trim()).join("goodboy-candidate-integrations");
    Ok(dir.join(format!("{}.journal", sanitize_slug(candidate_id))))
}

fn ensure_integrable_tree(cwd: &Path) -> Result<(), WorktreeError> {
    let tree = read_working_tree(cwd);
    let blocking = match tree {
        GitWorkingTree::Known {
            staged,
            unstaged,
            unmerged,
            ..
        } => staged + unstaged + unmerged,
        GitWorkingTree::Unknown { .. } => {
            return Err(WorktreeError::Git {
                message: "cannot verify the working tree because git status failed".to_string(),
            })
        }
    };
    if blocking > 0 {
        return Err(WorktreeError::Git {
            message: format!(
                "{blocking} uncommitted change(s) in the worktree: integrating would overwrite them"
            ),
        });
    }
    Ok(())
}

#[tauri::command]
pub async fn worktree_integrate_candidate(
    args: IntegrateCandidateArgs,
) -> Result<IntegratedCandidate, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || worktree_integrate_candidate_blocking(args))
        .await
        .map_err(|error| WorktreeError::Io(std::io::Error::other(error.to_string())))?
}

fn worktree_integrate_candidate_blocking(
    args: IntegrateCandidateArgs,
) -> Result<IntegratedCandidate, WorktreeError> {
    let path = Path::new(&args.worktree_path);
    if !path.exists() {
        return Err(WorktreeError::RepoNotFound(args.worktree_path));
    }
    let expected = resolve_commit(path, &args.expected_head)?;
    let candidate = resolve_commit(path, &args.candidate_sha)?;
    let journal = journal_path(path, &args.candidate_id)?;
    let picking = journal.with_extension("picking");
    if picking.exists() {
        crate::logging::note_failure("cherry-pick abort", git(path, &["cherry-pick", "--abort"]));
        std::fs::remove_file(&picking)?;
    }
    let actual = resolve_commit(path, "HEAD")?;
    if journal.exists() {
        let recorded = std::fs::read_to_string(&journal)?;
        let mut lines = recorded.lines().map(str::trim);
        if lines.next() != Some(candidate.as_str()) {
            return Err(WorktreeError::Git {
                message: "the integration journal holds a different commit for this candidate"
                    .to_string(),
            });
        }
        let integrated = lines.next().unwrap_or(candidate.as_str()).to_string();
        if is_ancestor(path, &integrated, &actual) {
            return Ok(IntegratedCandidate { sha: integrated });
        }
    }
    if !is_ancestor(path, &expected, &candidate) {
        return Err(WorktreeError::Git {
            message: "the candidate is not based on the expected branch head".to_string(),
        });
    }
    if !is_ancestor(path, &expected, &actual) {
        return Err(WorktreeError::Git {
            message: format!(
                "the branch moved: expected head {}, found {}",
                short_of(&expected),
                short_of(&actual)
            ),
        });
    }
    ensure_integrable_tree(path)?;
    let journal_dir = journal.parent().ok_or_else(|| WorktreeError::Git {
        message: "the integration journal has no parent directory".to_string(),
    })?;
    std::fs::create_dir_all(journal_dir)?;
    if actual == expected {
        write_journal(&journal, &[&candidate])?;
        git(path, &["update-ref", "HEAD", &candidate, &expected])?;
        git(path, &["reset", "--hard", "--quiet", &candidate])?;
        return Ok(IntegratedCandidate { sha: candidate });
    }
    if let Some(integrated) = landed_equivalent(path, &expected, &candidate, &actual)? {
        write_journal(&journal, &[&candidate, &integrated])?;
        return Ok(IntegratedCandidate { sha: integrated });
    }
    std::fs::write(&picking, format!("{candidate}\n"))?;
    let range = format!("{expected}..{candidate}");
    if git(path, &["cherry-pick", "--allow-empty", &range]).is_err() {
        crate::logging::note_failure("cherry-pick abort", git(path, &["cherry-pick", "--abort"]));
        crate::logging::note_failure(
            "candidate reset",
            git(path, &["reset", "--hard", "--quiet", &actual]),
        );
        std::fs::remove_file(&picking)?;
        return Err(WorktreeError::Git {
            message: "the fix no longer applies on the branch".to_string(),
        });
    }
    let integrated = resolve_commit(path, "HEAD")?;
    write_journal(&journal, &[&candidate, &integrated])?;
    std::fs::remove_file(&picking)?;
    Ok(IntegratedCandidate { sha: integrated })
}

pub(crate) fn landed_equivalent(
    cwd: &Path,
    expected: &str,
    candidate: &str,
    actual: &str,
) -> Result<Option<String>, WorktreeError> {
    let pending = git(cwd, &["cherry", actual, candidate, expected])?;
    let marks: Vec<&str> = pending
        .lines()
        .filter_map(|line| line.split_whitespace().next())
        .collect();
    if marks.is_empty() || marks.iter().any(|mark| *mark != "-") {
        return Ok(None);
    }
    let landed = git(cwd, &["cherry", candidate, actual, expected])?;
    Ok(landed
        .lines()
        .filter_map(|line| line.strip_prefix("- "))
        .map(str::trim)
        .next_back()
        .map(str::to_string))
}

fn write_journal(journal: &Path, lines: &[&str]) -> Result<(), WorktreeError> {
    let pending = journal.with_extension("pending");
    let body: String = lines.iter().map(|line| format!("{line}\n")).collect();
    std::fs::write(&pending, body)?;
    std::fs::rename(&pending, journal)?;
    Ok(())
}

#[tauri::command]
pub async fn worktree_quarantine_candidate(
    args: QuarantineCandidateArgs,
) -> Result<QuarantinedCandidate, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || worktree_quarantine_candidate_blocking(args))
        .await
        .map_err(|error| WorktreeError::Io(std::io::Error::other(error.to_string())))?
}

fn worktree_quarantine_candidate_blocking(
    args: QuarantineCandidateArgs,
) -> Result<QuarantinedCandidate, WorktreeError> {
    let path = Path::new(&args.worktree_path);
    if !path.exists() {
        return Err(WorktreeError::RepoNotFound(args.worktree_path));
    }
    let base = resolve_commit(path, &args.base_sha)?;
    let head = resolve_commit(path, "HEAD")?;
    if !is_ancestor(path, &base, &head) {
        return Err(WorktreeError::Git {
            message: "the branch head is not built on the recorded candidate base".to_string(),
        });
    }
    let is_dirty = match read_working_tree(path) {
        GitWorkingTree::Known { changed, .. } => changed > 0,
        GitWorkingTree::Unknown { .. } => {
            return Err(WorktreeError::Git {
                message: "cannot verify the working tree because git status failed".to_string(),
            })
        }
    };
    if is_dirty {
        git(path, &["add", "--update"])?;
        let staged = git(path, &["diff", "--cached", "--name-only"])?;
        if !staged.trim().is_empty() {
            git(
                path,
                &[
                    "commit",
                    "--no-verify",
                    "--quiet",
                    "-m",
                    &format!("candidate {}", sanitize_slug(&args.candidate_id)),
                ],
            )?;
        }
    }
    let raw_tip = resolve_commit(path, "HEAD")?;
    if raw_tip == base {
        return Ok(QuarantinedCandidate {
            sha: None,
            base_sha: base,
        });
    }
    let tip = scrub::scrub_environment(path, &base, &raw_tip, &args.candidate_id)?;
    if tip == base {
        git(path, &["update-ref", "HEAD", &base, &raw_tip])?;
        git(path, &["reset", "--hard", "--quiet", &base])?;
        return Ok(QuarantinedCandidate {
            sha: None,
            base_sha: base,
        });
    }
    git(
        path,
        &["update-ref", &candidate_ref(&args.candidate_id), &tip],
    )?;
    let rest_at = if args.stack { &tip } else { &base };
    git(path, &["update-ref", "HEAD", rest_at, &raw_tip])?;
    git(path, &["reset", "--hard", "--quiet", rest_at])?;
    Ok(QuarantinedCandidate {
        sha: Some(tip),
        base_sha: base,
    })
}

#[tauri::command]
pub async fn worktree_split_candidates(
    args: SplitCandidatesArgs,
) -> Result<Vec<SplitCandidate>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || worktree_split_candidates_blocking(args))
        .await
        .map_err(|error| WorktreeError::Io(std::io::Error::other(error.to_string())))?
}

fn worktree_split_candidates_blocking(
    args: SplitCandidatesArgs,
) -> Result<Vec<SplitCandidate>, WorktreeError> {
    let path = Path::new(&args.worktree_path);
    if !path.exists() {
        return Err(WorktreeError::RepoNotFound(args.worktree_path));
    }
    let base = resolve_commit(path, &args.base_sha)?;
    if args.stack {
        ensure_integrable_tree(path)?;
        return split_stacked(path, &base, args.picks);
    }
    if resolve_commit(path, "HEAD")? != base {
        return Err(WorktreeError::Git {
            message: "the copy is not at the candidate base".to_string(),
        });
    }
    ensure_integrable_tree(path)?;
    let mut out = Vec::with_capacity(args.picks.len());
    for pick in args.picks {
        let sha = split_one(path, &base, &pick)?;
        out.push(SplitCandidate {
            candidate_id: pick.candidate_id,
            sha,
        });
    }
    Ok(out)
}

fn unsplit(picks: Vec<SplitCandidatePick>) -> Vec<SplitCandidate> {
    picks
        .into_iter()
        .map(|pick| SplitCandidate {
            candidate_id: pick.candidate_id,
            sha: None,
        })
        .collect()
}

fn split_stacked(
    path: &Path,
    base: &str,
    picks: Vec<SplitCandidatePick>,
) -> Result<Vec<SplitCandidate>, WorktreeError> {
    let head = resolve_commit(path, "HEAD")?;
    if !is_ancestor(path, base, &head) {
        return Err(WorktreeError::Git {
            message: "the copy is not built on the candidate base".to_string(),
        });
    }
    let range = format!("{base}..{head}");
    let merges = git(path, &["rev-list", "--merges", &range])?;
    if !merges.trim().is_empty() {
        return Ok(unsplit(picks));
    }
    let listed = git(path, &["rev-list", "--reverse", &range])?;
    let order: Vec<&str> = listed.lines().map(str::trim).collect();
    let mut placed: Vec<(usize, String, String)> = Vec::with_capacity(picks.len());
    for pick in &picks {
        let Ok(commit) = resolve_commit(path, &pick.commit_sha) else {
            return Ok(unsplit(picks));
        };
        let Some(index) = order.iter().position(|item| *item == commit) else {
            return Ok(unsplit(picks));
        };
        placed.push((index, commit, pick.candidate_id.clone()));
    }
    placed.sort_by_key(|(index, _, _)| *index);
    let is_contiguous = placed.iter().enumerate().all(|(slot, item)| slot == item.0);
    if placed.len() != order.len() || !is_contiguous {
        return Ok(unsplit(picks));
    }
    for (_, commit, candidate_id) in &placed {
        git(path, &["update-ref", &candidate_ref(candidate_id), commit])?;
    }
    let mut done = Vec::with_capacity(picks.len());
    for pick in picks {
        let sha = placed
            .iter()
            .find(|item| item.2 == pick.candidate_id)
            .map(|item| item.1.clone());
        done.push(SplitCandidate {
            candidate_id: pick.candidate_id,
            sha,
        });
    }
    Ok(done)
}

fn split_one(
    path: &Path,
    base: &str,
    pick: &SplitCandidatePick,
) -> Result<Option<String>, WorktreeError> {
    let Ok(commit) = resolve_commit(path, &pick.commit_sha) else {
        return Ok(None);
    };
    if git(path, &["cherry-pick", "--allow-empty", &commit]).is_err() {
        crate::logging::note_failure(
            "split cherry-pick abort",
            git(path, &["cherry-pick", "--abort"]),
        );
        git(path, &["reset", "--hard", "--quiet", base])?;
        return Ok(None);
    }
    let tip = resolve_commit(path, "HEAD")?;
    git(
        path,
        &["update-ref", &candidate_ref(&pick.candidate_id), &tip],
    )?;
    git(path, &["reset", "--hard", "--quiet", base])?;
    Ok(Some(tip))
}

mod scrub;

#[cfg(test)]
mod tests;
