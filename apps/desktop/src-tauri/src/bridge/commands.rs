use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::{oneshot, Mutex};

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Origin {
    #[allow(dead_code)]
    Desktop,
    Mobile,
}

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
    AnswerQuestion,
    ApprovePlan,
    RequestPlanChanges,
    AnswerPermission,
    RaiseLimit,
    UndoRaiseLimit,
    StopRun,
    ContinueRun,
    StopAgent,
    ContinueAgent,
    AnswerSlackReply,
    QueryTranscript,
    SendToAgent,
    StopAgentTree,
    MergePrChecked,
    MergeTrain,
    StartSession,
    StopTrain,
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
            0x90 => Some(Self::AnswerQuestion),
            0x91 => Some(Self::ApprovePlan),
            0x92 => Some(Self::RequestPlanChanges),
            0x93 => Some(Self::AnswerPermission),
            0x94 => Some(Self::RaiseLimit),
            0x95 => Some(Self::UndoRaiseLimit),
            0x96 => Some(Self::StopRun),
            0x97 => Some(Self::ContinueRun),
            0x98 => Some(Self::StopAgent),
            0x99 => Some(Self::ContinueAgent),
            0x9A => Some(Self::AnswerSlackReply),
            0x9B => Some(Self::QueryTranscript),
            0x9C => Some(Self::SendToAgent),
            0x9D => Some(Self::StopAgentTree),
            0x9E => Some(Self::MergePrChecked),
            0x9F => Some(Self::MergeTrain),
            0xA0 => Some(Self::StartSession),
            0xA1 => Some(Self::StopTrain),
            _ => None,
        }
    }

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
            Self::AnswerQuestion => "answerQuestion",
            Self::ApprovePlan => "approvePlan",
            Self::RequestPlanChanges => "requestPlanChanges",
            Self::AnswerPermission => "answerPermission",
            Self::RaiseLimit => "raiseLimit",
            Self::UndoRaiseLimit => "undoRaiseLimit",
            Self::StopRun => "stopRun",
            Self::ContinueRun => "continueRun",
            Self::StopAgent => "stopAgent",
            Self::ContinueAgent => "continueAgent",
            Self::AnswerSlackReply => "answerSlackReply",
            Self::QueryTranscript => "queryTranscript",
            Self::SendToAgent => "sendToAgent",
            Self::StopAgentTree => "stopAgentTree",
            Self::MergePrChecked => "mergePr",
            Self::MergeTrain => "mergeTrain",
            Self::StartSession => "startSession",
            Self::StopTrain => "stopTrain",
        }
    }

    pub fn is_decide(self) -> bool {
        matches!(
            self,
            Self::AnswerQuestion
                | Self::ApprovePlan
                | Self::RequestPlanChanges
                | Self::AnswerPermission
                | Self::RaiseLimit
                | Self::UndoRaiseLimit
                | Self::StopRun
                | Self::ContinueRun
                | Self::StopAgent
                | Self::ContinueAgent
                | Self::SendToAgent
                | Self::StopAgentTree
                | Self::AnswerSlackReply
        )
    }

    pub fn needs_action_id(self) -> bool {
        self.is_decide()
            || matches!(
                self,
                Self::MergePr
                    | Self::MergePrChecked
                    | Self::MergeTrain
                    | Self::StartSession
                    | Self::StopTrain
            )
    }

    pub fn is_query(self) -> bool {
        matches!(
            self,
            Self::QueryProviders | Self::QueryIssues | Self::QueryFileDiff | Self::QueryTranscript
        )
    }
}

#[derive(Debug, Serialize)]
pub struct CommandEvent {
    pub id: String,
    pub kind: &'static str,
    pub origin: Origin,
    pub data: Value,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CmdResult {
    pub ok: bool,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub data: Option<Value>,
}

pub type PendingMap = Arc<Mutex<HashMap<String, oneshot::Sender<CmdResult>>>>;

pub const ACK_TIMEOUT: Duration = Duration::from_secs(30);

pub fn random_id() -> String {
    use rand::Rng;
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
        for op in [
            0x00u8, 0x01, 0x05, 0x07, 0x08, 0x09, 0x80, 0x81, 0x82, 0x89, 0x8F, 0xA2, 0xFF,
        ] {
            assert!(
                MobileAction::from_opcode(op).is_none(),
                "opcode {op:#x} must not map to a mobile action",
            );
        }
    }

    #[test]
    fn kind_strings_match_the_frontend_dispatcher() {
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
        assert!(MobileAction::QueryProviders.is_query());
        assert!(MobileAction::QueryIssues.is_query());
        assert!(MobileAction::QueryFileDiff.is_query());
        assert!(MobileAction::QueryTranscript.is_query());
        for op in [
            0x83u8, 0x84, 0x85, 0x86, 0x88, 0x8A, 0x8C, 0x8D, 0x90, 0x91, 0x92, 0x93, 0x94, 0x95,
            0x96, 0x97, 0x98, 0x99, 0x9A, 0x9C, 0x9D, 0x9E, 0x9F, 0xA0, 0xA1,
        ] {
            let action = MobileAction::from_opcode(op).expect("opcode is a write command");
            assert!(
                !action.is_query(),
                "{} must be a write, not a query",
                action.kind()
            );
            assert!(!action.kind().is_empty());
        }
    }

    #[test]
    fn maps_the_decide_opcodes_to_the_contract_kinds() {
        let expected = [
            (0x90u8, "answerQuestion"),
            (0x91, "approvePlan"),
            (0x92, "requestPlanChanges"),
            (0x93, "answerPermission"),
            (0x94, "raiseLimit"),
            (0x95, "undoRaiseLimit"),
            (0x96, "stopRun"),
            (0x97, "continueRun"),
            (0x98, "stopAgent"),
            (0x99, "continueAgent"),
            (0x9A, "answerSlackReply"),
            (0x9B, "queryTranscript"),
            (0x9C, "sendToAgent"),
            (0x9D, "stopAgentTree"),
        ];
        for (op, kind) in expected {
            let action = MobileAction::from_opcode(op).expect("decide opcode maps");
            assert_eq!(action.kind(), kind);
        }
    }
}
