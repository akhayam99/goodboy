use std::collections::HashSet;
use std::sync::Mutex;

use serde_json::{json, Value};

use super::commands::MobileAction;

const ACTION_ID_PREFIX: &str = "act:";
const ACTION_ID_MAX: usize = 256;

#[derive(Default)]
pub struct InFlight {
    ids: Mutex<HashSet<String>>,
}

pub struct Claim<'a> {
    owner: &'a InFlight,
    id: Option<String>,
}

impl Drop for Claim<'_> {
    fn drop(&mut self) {
        if let Some(id) = self.id.take() {
            if let Ok(mut ids) = self.owner.ids.lock() {
                ids.remove(&id);
            }
        }
    }
}

impl InFlight {
    pub fn claim(&self, id: &str) -> Option<Claim<'_>> {
        let mut ids = self.ids.lock().ok()?;
        if !ids.insert(id.to_string()) {
            return None;
        }
        Some(Claim {
            owner: self,
            id: Some(id.to_string()),
        })
    }

    #[cfg(test)]
    pub fn len(&self) -> usize {
        self.ids.lock().map(|ids| ids.len()).unwrap_or(0)
    }
}

pub enum Refusal {
    BadActionId { cmd_id: String },
    InFlight { cmd_id: String },
}

impl Refusal {
    pub fn reply(&self) -> Value {
        match self {
            Self::BadActionId { cmd_id } => {
                json!({ "cmdId": cmd_id, "ok": false, "error": "invalid_action_id" })
            }
            Self::InFlight { cmd_id } => {
                json!({ "cmdId": cmd_id, "ok": false, "error": "action_in_flight" })
            }
        }
    }
}

pub fn correlation_of(data: &Value) -> Option<String> {
    data.get("cmdId")
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty() && id.len() <= ACTION_ID_MAX)
        .map(str::to_string)
}

pub fn stamp_phone(data: Value, phone_id: &str) -> Value {
    let mut map = match data {
        Value::Object(map) => map,
        _ => serde_json::Map::new(),
    };
    map.insert("phoneId".into(), Value::String(phone_id.to_string()));
    Value::Object(map)
}

pub fn action_id_of(action: MobileAction, data: &Value) -> Result<Option<String>, Refusal> {
    if !action.needs_action_id() {
        return Ok(None);
    }
    let cmd_id = correlation_of(data).unwrap_or_default();
    let id = data
        .get("actionId")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let is_well_formed =
        id.starts_with(ACTION_ID_PREFIX) && id.len() <= ACTION_ID_MAX && cmd_id == id;
    match is_well_formed {
        true => Ok(Some(id)),
        false => Err(Refusal::BadActionId { cmd_id }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_action_id_already_in_flight_is_refused_until_the_first_one_ends() {
        let flight = InFlight::default();
        let first = flight.claim("act:answerQuestion:q1:v1");

        assert!(first.is_some());
        assert!(flight.claim("act:answerQuestion:q1:v1").is_none());
        assert!(flight.claim("act:answerQuestion:q2:v1").is_some());
        drop(first);
        assert!(flight.claim("act:answerQuestion:q1:v1").is_some());
    }

    #[test]
    fn dropping_every_claim_leaves_nothing_in_flight() {
        let flight = InFlight::default();
        {
            let _a = flight.claim("act:stopRun:r1:running");
            let _b = flight.claim("act:stopRun:r2:running");
            assert_eq!(flight.len(), 2);
        }
        assert_eq!(flight.len(), 0);
    }

    #[test]
    fn the_phone_id_is_stamped_over_anything_the_phone_sent() {
        let sent = json!({ "phoneId": "someone-else", "workspaceId": "w1" });

        let stamped = stamp_phone(sent, "phone-key");

        assert_eq!(stamped["phoneId"], "phone-key");
        assert_eq!(stamped["workspaceId"], "w1");
        assert_eq!(stamp_phone(Value::Null, "k")["phoneId"], "k");
    }

    #[test]
    fn a_decide_action_needs_an_id_in_the_mac_format() {
        let ok = json!({ "cmdId": "act:stopRun:r1:running", "actionId": "act:stopRun:r1:running" });
        let phone_minted = json!({ "cmdId": "my-own-id" });
        let split =
            json!({ "cmdId": "act:stopRun:r1:running", "actionId": "act:stopRun:r2:running" });

        assert!(matches!(
            action_id_of(MobileAction::StopRun, &ok),
            Ok(Some(_))
        ));
        assert!(action_id_of(MobileAction::StopRun, &phone_minted).is_err());
        assert!(action_id_of(MobileAction::StopRun, &split).is_err());
        assert!(action_id_of(MobileAction::StopRun, &json!({})).is_err());
        let only_cmd_id = json!({ "cmdId": "act:stopRun:r1:running" });
        let only_action_id = json!({ "actionId": "act:stopRun:r1:running" });
        let empty_cmd_id = json!({ "cmdId": "", "actionId": "act:stopRun:r1:running" });
        let long = format!("act:{}", "x".repeat(ACTION_ID_MAX));
        let overlong = json!({ "cmdId": long, "actionId": long });
        for bad in [only_cmd_id, only_action_id, empty_cmd_id, overlong] {
            assert!(action_id_of(MobileAction::StopRun, &bad).is_err());
        }
    }

    #[test]
    fn merge_and_start_actions_need_an_id_in_the_mac_format() {
        for action in [
            MobileAction::MergePr,
            MobileAction::MergePrChecked,
            MobileAction::MergeTrain,
            MobileAction::StartSession,
            MobileAction::StopTrain,
        ] {
            let bad = json!({ "cmdId": "c1" });
            assert!(action_id_of(action, &bad).is_err());
            let ok = json!({ "cmdId": "act:x:1:2", "actionId": "act:x:1:2" });
            assert!(matches!(action_id_of(action, &ok), Ok(Some(id)) if id == "act:x:1:2"));
        }
    }

    #[test]
    fn other_actions_carry_no_action_id() {
        let data = json!({ "cmdId": "anything" });

        assert!(matches!(action_id_of(MobileAction::Send, &data), Ok(None)));
        assert!(matches!(
            action_id_of(MobileAction::QueryTranscript, &data),
            Ok(None)
        ));
    }

    #[test]
    fn a_refusal_names_the_phone_correlation_and_a_code() {
        let reply = Refusal::InFlight {
            cmd_id: "c1".into(),
        }
        .reply();

        assert_eq!(reply["cmdId"], "c1");
        assert_eq!(reply["ok"], false);
        assert_eq!(reply["error"], "action_in_flight");
    }
}
