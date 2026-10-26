use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AuthReason {
    TimedOut { secs: u64 },
    NotInstalled,
    SpawnFailed { detail: String },
    CliSaid { detail: String },
    PrintedNothing,
    ExitedWithCode { code: i32 },
    NoExitCode,
    EmptyCommand,
    NoAccessToken,
    NotConfirmedByServer,
    NoStatus,
    UnknownProvider,
    CheckUnfinished,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wire(reason: AuthReason) -> serde_json::Value {
        serde_json::to_value(reason).expect("serializes")
    }

    #[test]
    fn timed_out_carries_its_seconds() {
        assert_eq!(
            wire(AuthReason::TimedOut { secs: 10 }),
            serde_json::json!({ "kind": "timed_out", "secs": 10 })
        );
    }

    #[test]
    fn spawn_failed_carries_the_os_detail() {
        assert_eq!(
            wire(AuthReason::SpawnFailed {
                detail: "permission denied".into()
            }),
            serde_json::json!({ "kind": "spawn_failed", "detail": "permission denied" })
        );
    }

    #[test]
    fn cli_said_carries_the_cli_text() {
        assert_eq!(
            wire(AuthReason::CliSaid {
                detail: "new wording".into()
            }),
            serde_json::json!({ "kind": "cli_said", "detail": "new wording" })
        );
    }

    #[test]
    fn exited_with_code_carries_the_code() {
        assert_eq!(
            wire(AuthReason::ExitedWithCode { code: 2 }),
            serde_json::json!({ "kind": "exited_with_code", "code": 2 })
        );
    }

    #[test]
    fn the_kinds_without_a_payload_are_bare() {
        let cases = [
            (AuthReason::NotInstalled, "not_installed"),
            (AuthReason::PrintedNothing, "printed_nothing"),
            (AuthReason::NoExitCode, "no_exit_code"),
            (AuthReason::EmptyCommand, "empty_command"),
            (AuthReason::NoAccessToken, "no_access_token"),
            (AuthReason::NotConfirmedByServer, "not_confirmed_by_server"),
            (AuthReason::NoStatus, "no_status"),
            (AuthReason::UnknownProvider, "unknown_provider"),
            (AuthReason::CheckUnfinished, "check_unfinished"),
        ];
        for (reason, kind) in cases {
            assert_eq!(wire(reason), serde_json::json!({ "kind": kind }));
        }
    }
}
