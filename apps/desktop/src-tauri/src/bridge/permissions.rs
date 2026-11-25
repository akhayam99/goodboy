use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::commands::MobileAction;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Permissions {
    pub can_decide: bool,
    pub can_merge: bool,
    pub can_start: bool,
}

impl Default for Permissions {
    fn default() -> Self {
        Self {
            can_decide: true,
            can_merge: true,
            can_start: false,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Permission {
    Decide,
    Merge,
    Start,
}

impl Permission {
    pub fn name(self) -> &'static str {
        match self {
            Self::Decide => "decide",
            Self::Merge => "merge",
            Self::Start => "start",
        }
    }
}

impl Permissions {
    pub fn allows(&self, permission: Permission) -> bool {
        match permission {
            Permission::Decide => self.can_decide,
            Permission::Merge => self.can_merge,
            Permission::Start => self.can_start,
        }
    }

    pub fn wire(&self) -> Value {
        json!({
            "canRead": true,
            "canDecide": self.can_decide,
            "canMerge": self.can_merge,
            "canStart": self.can_start,
        })
    }
}

pub fn permission_for(action: MobileAction) -> Option<Permission> {
    match action {
        MobileAction::QueryProviders | MobileAction::QueryIssues | MobileAction::QueryFileDiff => {
            None
        }
        MobileAction::Send
        | MobileAction::AdvanceStep
        | MobileAction::ResolveComment
        | MobileAction::SetContextSlot => Some(Permission::Decide),
        MobileAction::MergePr => Some(Permission::Merge),
        MobileAction::SpawnAgent
        | MobileAction::SpawnWorkflow
        | MobileAction::CreateSessionFromIssue => Some(Permission::Start),
    }
}

pub fn denial(data: &Value, permission: Permission) -> Value {
    let cmd_id = data.get("cmdId").and_then(Value::as_str).unwrap_or("");
    json!({
        "cmdId": cmd_id,
        "ok": false,
        "error": "permission_denied",
        "data": { "permission": permission.name() },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_new_phone_may_decide_and_merge_but_not_start_sessions() {
        let defaults = Permissions::default();

        assert!(defaults.can_decide);
        assert!(defaults.can_merge);
        assert!(!defaults.can_start);
    }

    #[test]
    fn queries_need_no_permission_and_every_write_names_one() {
        for op in [0x87u8, 0x8B, 0x8E] {
            let action = MobileAction::from_opcode(op).unwrap();
            assert_eq!(permission_for(action), None);
        }
        for op in [0x83u8, 0x84, 0x85, 0x86, 0x88, 0x8A, 0x8C, 0x8D] {
            let action = MobileAction::from_opcode(op).unwrap();
            assert!(permission_for(action).is_some(), "{}", action.kind());
        }
    }

    #[test]
    fn starting_a_session_in_any_form_needs_the_start_permission() {
        for action in [
            MobileAction::SpawnAgent,
            MobileAction::SpawnWorkflow,
            MobileAction::CreateSessionFromIssue,
        ] {
            assert_eq!(permission_for(action), Some(Permission::Start));
        }
        assert_eq!(
            permission_for(MobileAction::MergePr),
            Some(Permission::Merge)
        );
    }

    #[test]
    fn a_denial_names_the_command_and_the_missing_permission() {
        let res = denial(&json!({ "cmdId": "c1" }), Permission::Start);

        assert_eq!(res["cmdId"], "c1");
        assert_eq!(res["ok"], false);
        assert_eq!(res["error"], "permission_denied");
        assert_eq!(res["data"]["permission"], "start");
    }

    #[test]
    fn the_wire_form_always_grants_read() {
        let wire = Permissions {
            can_decide: false,
            can_merge: false,
            can_start: true,
        }
        .wire();

        assert_eq!(wire["canRead"], true);
        assert_eq!(wire["canDecide"], false);
        assert_eq!(wire["canStart"], true);
    }
}
