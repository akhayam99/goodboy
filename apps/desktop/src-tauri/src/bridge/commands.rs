//! Mobile write-command plumbing.
//!
//! Security model (see PROTOCOL.md / companion design): the phone may request
//! only a CLOSED set of actions. It never supplies an origin, a path, a working
//! dir, or tool/permission flags — just the action's data. The bridge stamps
//! `origin = Mobile` server-side (unforgeable) and forwards the command to the
//! trusted desktop frontend, which validates scope and executes through the same
//! store actions the desktop UI uses. There is intentionally no raw/exec variant.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::{oneshot, Mutex};

/// Who originated a command. Assigned by the trusted server from the channel it
/// arrived on — NEVER read from client input. The phone cannot forge `Desktop`.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Origin {
    #[allow(dead_code)]
    Desktop,
    Mobile,
}

/// Closed set of actions a mobile client may request. No raw/exec/path variant
/// exists, so the phone cannot express anything outside these. `QueryProviders`
/// is read-only: it returns the desktop's provider/model menu so the phone's
/// composer can offer a picker, without the phone hardcoding the registry.
#[derive(Debug, Clone, Copy)]
pub enum MobileAction {
    AdvanceStep,
    Send,
    SpawnAgent,
    ResolveComment,
    SetContextSlot,
    QueryProviders,
    MergePr,
    QueryIssues,
    CreateSessionFromIssue,
    SpawnWorkflow,
    QueryFileDiff,
}

impl MobileAction {
    pub fn from_opcode(op: u8) -> Option<Self> {
        match op {
            0x83 => Some(Self::AdvanceStep),
            0x84 => Some(Self::Send),
            0x85 => Some(Self::SpawnAgent),
            0x86 => Some(Self::ResolveComment),
            0x87 => Some(Self::QueryProviders),
            0x88 => Some(Self::SetContextSlot),
            0x8A => Some(Self::MergePr),
            0x8B => Some(Self::QueryIssues),
            0x8C => Some(Self::CreateSessionFromIssue),
            0x8D => Some(Self::SpawnWorkflow),
            0x8E => Some(Self::QueryFileDiff),
            _ => None,
        }
    }

    /// Stable string the frontend dispatcher switches on.
    pub fn kind(self) -> &'static str {
        match self {
            Self::AdvanceStep => "advanceStep",
            Self::Send => "send",
            Self::SpawnAgent => "spawnAgent",
            Self::ResolveComment => "resolveComment",
            Self::SetContextSlot => "setContextSlot",
            Self::QueryProviders => "queryProviders",
            Self::MergePr => "mergePr",
            Self::QueryIssues => "queryIssues",
            Self::CreateSessionFromIssue => "createSessionFromIssue",
            Self::SpawnWorkflow => "spawnWorkflow",
            Self::QueryFileDiff => "queryFileDiff",
        }
    }

    /// Read-only queries get their result frame (OP_QUERY_RESULT) instead of a
    /// write ACK; the phone routes the response to a data continuation.
    pub fn is_query(self) -> bool {
        matches!(
            self,
            Self::QueryProviders | Self::QueryIssues | Self::QueryFileDiff
        )
    }
}

/// Payload forwarded to the frontend executor over the `bridge://command` event.
/// `origin` and `kind` are server-set; `data` is the phone's raw fields (only
/// known keys are ever read downstream).
#[derive(Debug, Serialize)]
pub struct CommandEvent {
    pub id: String,
    pub kind: &'static str,
    pub origin: Origin,
    pub data: Value,
}

/// What the frontend reports back via `bridge_command_result`. `data` is only
/// populated for read-only queries (e.g. the provider menu); write commands
/// leave it `None` and the phone ignores it.
#[derive(Debug, Clone, Deserialize)]
pub struct CmdResult {
    pub ok: bool,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub data: Option<Value>,
}

/// In-flight commands awaiting a frontend result, keyed by command id.
pub type PendingMap = Arc<Mutex<HashMap<String, oneshot::Sender<CmdResult>>>>;

/// How long the bridge waits for the frontend to acknowledge a command before
/// giving up and telling the phone it failed.
pub const ACK_TIMEOUT: Duration = Duration::from_secs(30);

/// Fallback command id when the phone omits one (it normally supplies its own
/// correlation id so it can match the ACK).
pub fn random_id() -> String {
    use rand::RngCore;
    let mut b = [0u8; 16];
    rand::rng().fill_bytes(&mut b);
    b.iter().map(|x| format!("{x:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_the_command_opcodes() {
        assert!(matches!(
            MobileAction::from_opcode(0x83),
            Some(MobileAction::AdvanceStep)
        ));
        assert!(matches!(
            MobileAction::from_opcode(0x84),
            Some(MobileAction::Send)
        ));
        assert!(matches!(
            MobileAction::from_opcode(0x85),
            Some(MobileAction::SpawnAgent)
        ));
        assert!(matches!(
            MobileAction::from_opcode(0x86),
            Some(MobileAction::ResolveComment)
        ));
        assert!(matches!(
            MobileAction::from_opcode(0x87),
            Some(MobileAction::QueryProviders)
        ));
        assert!(matches!(
            MobileAction::from_opcode(0x88),
            Some(MobileAction::SetContextSlot)
        ));
        assert!(matches!(
            MobileAction::from_opcode(0x8A),
            Some(MobileAction::MergePr)
        ));
        assert!(matches!(
            MobileAction::from_opcode(0x8B),
            Some(MobileAction::QueryIssues)
        ));
        assert!(matches!(
            MobileAction::from_opcode(0x8C),
            Some(MobileAction::CreateSessionFromIssue)
        ));
        assert!(matches!(
            MobileAction::from_opcode(0x8D),
            Some(MobileAction::SpawnWorkflow)
        ));
        assert!(matches!(
            MobileAction::from_opcode(0x8E),
            Some(MobileAction::QueryFileDiff)
        ));
    }

    #[test]
    fn rejects_read_server_and_unknown_opcodes() {
        // Server->client (0x01-0x09) and client read opcodes (0x80-0x82) are not
        // mobile actions and must never resolve to one.
        for op in [
            0x00u8, 0x01, 0x05, 0x07, 0x08, 0x09, 0x80, 0x81, 0x82, 0x89, 0x8F, 0xFF,
        ] {
            assert!(
                MobileAction::from_opcode(op).is_none(),
                "opcode {op:#x} must not map to a mobile action",
            );
        }
    }

    #[test]
    fn kind_strings_match_the_frontend_dispatcher() {
        // These literals are switched on in commandExecutor.ts — keep them in sync.
        assert_eq!(MobileAction::AdvanceStep.kind(), "advanceStep");
        assert_eq!(MobileAction::Send.kind(), "send");
        assert_eq!(MobileAction::SpawnAgent.kind(), "spawnAgent");
        assert_eq!(MobileAction::ResolveComment.kind(), "resolveComment");
        assert_eq!(MobileAction::SetContextSlot.kind(), "setContextSlot");
        assert_eq!(MobileAction::QueryProviders.kind(), "queryProviders");
        assert_eq!(MobileAction::MergePr.kind(), "mergePr");
        assert_eq!(MobileAction::QueryIssues.kind(), "queryIssues");
        assert_eq!(
            MobileAction::CreateSessionFromIssue.kind(),
            "createSessionFromIssue"
        );
        assert_eq!(MobileAction::SpawnWorkflow.kind(), "spawnWorkflow");
        assert_eq!(MobileAction::QueryFileDiff.kind(), "queryFileDiff");
    }

    #[test]
    fn only_query_actions_report_as_queries() {
        // Read-only queries return data frames; everything else is a write ACK.
        assert!(MobileAction::QueryProviders.is_query());
        assert!(MobileAction::QueryIssues.is_query());
        assert!(MobileAction::QueryFileDiff.is_query());
        // createSessionFromIssue (0x8C) and spawnWorkflow (0x8D) are WRITEs — they ACK.
        for op in [0x83u8, 0x84, 0x85, 0x86, 0x88, 0x8A, 0x8C, 0x8D] {
            let action = MobileAction::from_opcode(op).expect("opcode is a write command");
            assert!(
                !action.is_query(),
                "{} must be a write, not a query",
                action.kind()
            );
            assert!(!action.kind().is_empty());
        }
    }
}
