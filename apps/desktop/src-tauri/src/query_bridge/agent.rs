use std::time::Duration;

use rusqlite::{Connection, OptionalExtension};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

use super::capability::{self, CapabilityGrant, CapabilityRefusal, CapabilityRegistry, LiveTree};
use super::mount::handoff_on;
use super::protocol::{BridgeError, QueryRequest, CAPABILITY_REFUSED, OPERATION_PENDING};
use crate::db::Db;

const AGENT_EVENT: &str = "query-bridge://agent-command";
const AGENT_TIMEOUT: Duration = Duration::from_secs(90);

#[derive(Debug, Clone, PartialEq, Eq)]
struct LiveTreeRow {
    generation: u64,
    active_run_id: Option<String>,
}

fn read_live_tree(conn: &Connection, tree_id: &str) -> Result<Option<LiveTreeRow>, String> {
    conn.query_row(
        "SELECT generation, active_run_id FROM auto_trees WHERE id = ?1",
        rusqlite::params![tree_id],
        |row| {
            Ok(LiveTreeRow {
                generation: row.get::<_, i64>(0)?.max(0) as u64,
                active_run_id: row.get(1)?,
            })
        },
    )
    .optional()
    .map_err(|error| error.to_string())
}

fn refusal_message(refusal: CapabilityRefusal) -> &'static str {
    match refusal {
        CapabilityRefusal::MissingToken => {
            "this command is only for the Auto agent of a conversation, and this turn holds no capability"
        }
        CapabilityRefusal::UnknownToken => "the capability of this turn is not known to Goodboy",
        CapabilityRefusal::Revoked => {
            "the capability of this turn was revoked: the turn ended or the work was stopped"
        }
        CapabilityRefusal::Expired => "the capability of this turn expired",
        CapabilityRefusal::VerbNotPermitted => "this capability does not allow that command",
        CapabilityRefusal::WrongTree => "this capability belongs to another conversation",
        CapabilityRefusal::StaleGeneration => {
            "the work was stopped or restarted since this turn began"
        }
        CapabilityRefusal::WrongRun => "this turn is no longer the one Auto is answering in",
    }
}

fn refused(refusal: CapabilityRefusal) -> BridgeError {
    BridgeError::coded(CAPABILITY_REFUSED, refusal_message(refusal))
}

fn authorize_call(
    registry: &CapabilityRegistry,
    conn: &Connection,
    token: Option<&str>,
    verb: &str,
    now_ms: u64,
) -> Result<CapabilityGrant, BridgeError> {
    let token = token
        .filter(|value| !value.is_empty())
        .ok_or_else(|| refused(CapabilityRefusal::MissingToken))?;
    let grant = registry
        .grant_of(token)
        .ok_or_else(|| refused(CapabilityRefusal::UnknownToken))?;
    let row = read_live_tree(conn, &grant.tree_id)?
        .ok_or_else(|| refused(CapabilityRefusal::WrongTree))?;
    registry
        .authorize(
            Some(token),
            &format!("agent {verb}"),
            LiveTree {
                tree_id: &grant.tree_id,
                generation: row.generation,
                active_run_id: row.active_run_id.as_deref().unwrap_or(""),
            },
            now_ms,
        )
        .map_err(refused)
}

fn timeout_error() -> BridgeError {
    BridgeError::coded(
        OPERATION_PENDING,
        "the app did not answer in time: a delegate call may still have been accepted, read it with `agent request-status --request-id <id>` instead of sending a new id",
    )
}

pub(super) async fn dispatch(
    app: &AppHandle,
    request: &QueryRequest,
) -> Result<Value, BridgeError> {
    let grant = {
        let state = app.state::<Db>();
        let conn = state
            .0
            .lock()
            .map_err(|_| "db mutex poisoned".to_string())?;
        authorize_call(
            capability::registry(),
            &conn,
            request.capability.as_deref(),
            &request.verb,
            capability::now_ms(),
        )?
    };
    handoff_on(
        app,
        AGENT_EVENT,
        AGENT_TIMEOUT,
        timeout_error(),
        json!({
            "verb": request.verb,
            "args": request.args,
            "grant": {
                "agentId": grant.agent_id,
                "treeId": grant.tree_id,
                "generation": grant.generation,
                "workspaceId": grant.workspace_id,
                "sessionId": grant.session_id,
                "runId": grant.run_id,
            },
        }),
    )
    .await
}

pub(super) fn is_auto_run(request: &QueryRequest) -> bool {
    request
        .run_id
        .as_deref()
        .is_some_and(|run_id| capability::registry().holds_run(run_id, capability::now_ms()))
}

pub(super) fn auto_may_not_write() -> BridgeError {
    BridgeError::coded(
        CAPABILITY_REFUSED,
        "the Auto agent hands work to other agents and never changes anything itself, so this command is not available to it",
    )
}

#[tauri::command]
pub fn auto_capability_revoke_tree(tree_id: String) -> usize {
    capability::registry().revoke_tree(&tree_id)
}

#[tauri::command]
pub fn auto_capability_revoke_generation(tree_id: String, generation: u64) -> usize {
    capability::registry().revoke_before_generation(&tree_id, generation)
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: u64 = 5_000_000;

    fn conn() -> Connection {
        let conn = Connection::open_in_memory().expect("database");
        conn.execute_batch(
            "CREATE TABLE auto_trees (id TEXT PRIMARY KEY, generation INTEGER NOT NULL, active_run_id TEXT);
             INSERT INTO auto_trees (id, generation, active_run_id) VALUES ('tree-1', 2, 'run-7');",
        )
        .expect("schema");
        conn
    }

    fn grant() -> CapabilityGrant {
        CapabilityGrant {
            agent_id: "agent-auto".to_string(),
            tree_id: "tree-1".to_string(),
            generation: 2,
            workspace_id: "workspace-northwind".to_string(),
            session_id: "session-acme".to_string(),
            run_id: "run-7".to_string(),
        }
    }

    fn minted() -> (CapabilityRegistry, String) {
        let registry = CapabilityRegistry::default();
        let token = registry.mint(grant(), NOW);
        (registry, token)
    }

    fn code_of(error: BridgeError) -> (Option<String>, String) {
        (error.code, error.message)
    }

    #[test]
    fn the_live_turn_of_the_tree_is_authorized_for_every_agent_verb() {
        let (registry, token) = minted();
        let conn = conn();

        for verb in ["delegate", "status", "request-status", "answer", "finish"] {
            assert_eq!(
                authorize_call(&registry, &conn, Some(&token), verb, NOW).expect(verb),
                grant()
            );
        }
    }

    #[test]
    fn a_call_without_a_token_is_refused_so_a_child_cannot_delegate() {
        let (registry, _) = minted();
        let conn = conn();

        for token in [None, Some("")] {
            let (code, message) = code_of(
                authorize_call(&registry, &conn, token, "delegate", NOW).expect_err("refused"),
            );
            assert_eq!(code.as_deref(), Some(CAPABILITY_REFUSED));
            assert!(message.contains("holds no capability"));
        }
    }

    #[test]
    fn a_forged_environment_id_is_refused() {
        let (registry, _) = minted();
        let conn = conn();

        let error = authorize_call(&registry, &conn, Some("agent-auto"), "delegate", NOW)
            .expect_err("forged");

        assert_eq!(error.code.as_deref(), Some(CAPABILITY_REFUSED));
        assert!(error.message.contains("not known"));
    }

    #[test]
    fn a_token_is_refused_once_its_turn_ended() {
        let (registry, token) = minted();
        let conn = conn();
        registry.revoke_turn(&token);

        let error =
            authorize_call(&registry, &conn, Some(&token), "delegate", NOW).expect_err("revoked");

        assert!(error.message.contains("revoked"));
    }

    #[test]
    fn a_token_of_an_older_generation_is_refused_after_a_stop() {
        let (registry, token) = minted();
        let conn = conn();
        conn.execute("UPDATE auto_trees SET generation = 3", [])
            .expect("stop");

        let error =
            authorize_call(&registry, &conn, Some(&token), "delegate", NOW).expect_err("stale");

        assert!(error.message.contains("stopped or restarted"));
    }

    #[test]
    fn a_token_is_refused_when_the_tree_moved_to_another_turn() {
        let (registry, token) = minted();
        let conn = conn();
        conn.execute("UPDATE auto_trees SET active_run_id = 'run-8'", [])
            .expect("next turn");

        let error =
            authorize_call(&registry, &conn, Some(&token), "delegate", NOW).expect_err("wrong run");

        assert!(error.message.contains("no longer the one"));
    }

    #[test]
    fn a_token_is_refused_when_the_tree_has_no_active_turn_or_no_row() {
        let (registry, token) = minted();
        let conn = conn();
        conn.execute("UPDATE auto_trees SET active_run_id = NULL", [])
            .expect("idle");
        assert!(authorize_call(&registry, &conn, Some(&token), "delegate", NOW).is_err());
        conn.execute("DELETE FROM auto_trees", []).expect("deleted");
        let error =
            authorize_call(&registry, &conn, Some(&token), "delegate", NOW).expect_err("no tree");
        assert!(error.message.contains("another conversation"));
    }

    #[test]
    fn a_command_outside_the_closed_set_is_refused_for_the_auto_token() {
        let (registry, token) = minted();
        let conn = conn();

        let error = authorize_call(&registry, &conn, Some(&token), "fork", NOW).expect_err("fork");

        assert!(error.message.contains("does not allow"));
    }

    #[test]
    fn the_run_of_an_auto_turn_is_known_to_the_bridge_so_its_other_writes_can_be_refused() {
        let registry = capability::registry();
        let grant = CapabilityGrant {
            run_id: "run-agent-test-9".to_string(),
            ..grant()
        };
        registry.mint(grant, capability::now_ms());

        let request = QueryRequest {
            workspace_id: "workspace-northwind".to_string(),
            session_id: "session-acme".to_string(),
            project: String::new(),
            mount: String::new(),
            run_id: Some("run-agent-test-9".to_string()),
            capability: None,
            provider: "mount".to_string(),
            verb: "fork".to_string(),
            args: Default::default(),
        };
        let other = QueryRequest {
            run_id: Some("run-child".to_string()),
            ..request.clone()
        };

        assert!(is_auto_run(&request));
        assert!(!is_auto_run(&other));
        assert_eq!(
            auto_may_not_write().code.as_deref(),
            Some(CAPABILITY_REFUSED)
        );
    }
}
