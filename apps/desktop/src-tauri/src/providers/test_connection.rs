use std::time::{Duration, Instant};

use serde::Serialize;

use crate::proc::probe;

const TEST_TIMEOUT: Duration = Duration::from_secs(15);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionOutcome {
    Answered,
    TimedOut,
    Empty,
    Unsupported,
    Refused,
}

#[derive(Debug, Serialize)]
pub struct ConnectionTestResult {
    pub ok: bool,
    pub millis: u128,
    pub outcome: ConnectionOutcome,
    pub secs: Option<u64>,
    pub detail: String,
    pub models: Vec<String>,
}

#[derive(Debug, PartialEq, Eq)]
enum Probed {
    Answered { models: Vec<String> },
    TimedOut { secs: u64 },
    Empty,
    Unsupported,
    Refused { detail: String },
}

const MAX_LISTED_MODELS: usize = 1024;

fn model_id_of(line: &str) -> Option<&str> {
    let id = line.split_whitespace().next().unwrap_or_default();
    let is_id = id.len() <= 256
        && id.starts_with(|c: char| c.is_ascii_lowercase())
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "-_.[],:=".contains(c));
    if !is_id {
        return None;
    }
    Some(id)
}

fn listed_models(output: &str) -> Vec<String> {
    let clean = super::strip_ansi(output);
    let mut is_listing = false;
    let mut models: Vec<String> = Vec::new();
    for line in clean.lines().map(str::trim) {
        if line.starts_with("```") {
            return Vec::new();
        }
        if line == "Available models" {
            is_listing = true;
            continue;
        }
        if !is_listing || line.is_empty() {
            continue;
        }
        if line.starts_with("Tip:") {
            return models;
        }
        let Some(id) = model_id_of(line) else {
            continue;
        };
        if models.len() >= MAX_LISTED_MODELS {
            return Vec::new();
        }
        if !models.iter().any(|known| known == id) {
            models.push(id.to_string());
        }
    }
    models
}

fn cursor_test(binary: &str, timeout: Duration) -> Probed {
    let mut command = crate::path_env::command(binary);
    command.arg("models");
    crate::aux_spawn::scrub_nested_session_env(&mut command);
    let output = match probe::run(command, Instant::now() + timeout) {
        Ok(output) => output,
        Err(error) => {
            return Probed::Refused {
                detail: error.to_string(),
            }
        }
    };
    if output.timed_out {
        return Probed::TimedOut {
            secs: timeout.as_secs(),
        };
    }
    let models = listed_models(&output.stdout);
    if output.code == Some(0) && !models.is_empty() {
        return Probed::Answered { models };
    }
    let detail = output.primary_text();
    if detail.is_empty() {
        return Probed::Empty;
    }
    Probed::Refused {
        detail: super::strip_ansi(detail),
    }
}

fn result_of(started: Instant, probed: Probed) -> ConnectionTestResult {
    let millis = started.elapsed().as_millis();
    let (outcome, secs, detail, models) = match probed {
        Probed::Answered { models } => (ConnectionOutcome::Answered, None, String::new(), models),
        Probed::TimedOut { secs } => (
            ConnectionOutcome::TimedOut,
            Some(secs),
            String::new(),
            Vec::new(),
        ),
        Probed::Empty => (ConnectionOutcome::Empty, None, String::new(), Vec::new()),
        Probed::Unsupported => (
            ConnectionOutcome::Unsupported,
            None,
            String::new(),
            Vec::new(),
        ),
        Probed::Refused { detail } => (ConnectionOutcome::Refused, None, detail, Vec::new()),
    };
    ConnectionTestResult {
        ok: outcome == ConnectionOutcome::Answered,
        millis,
        outcome,
        secs,
        detail,
        models,
    }
}

#[tauri::command]
pub async fn provider_test_connection(provider_id: String) -> ConnectionTestResult {
    let started = Instant::now();
    let result = match provider_id.as_str() {
        "cursor" => {
            tauri::async_runtime::spawn_blocking(|| cursor_test("cursor-agent", TEST_TIMEOUT))
                .await
                .unwrap_or_else(|e| Probed::Refused {
                    detail: e.to_string(),
                })
        }
        "anthropic" => match crate::usage_probe::claude_usage_probe().await {
            Ok(_) => Probed::Answered { models: Vec::new() },
            Err(error) => Probed::Refused {
                detail: error.to_string(),
            },
        },
        "codex" => match crate::codex_app_server::codex_rate_limits_probe(false).await {
            Ok(_) => Probed::Answered { models: Vec::new() },
            Err(error) => Probed::Refused {
                detail: error.to_string(),
            },
        },
        _ => Probed::Unsupported,
    };
    result_of(started, result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fake_cli::FakeCli;

    #[test]
    fn models_answer_with_elapsed_time() {
        let fake = FakeCli::stage("ok");
        let started = Instant::now();
        let result = result_of(
            started,
            cursor_test(&fake.binary("cursor-agent"), TEST_TIMEOUT),
        );
        assert!(result.ok);
        assert!(result.millis > 0);
        assert_eq!(result.models, vec!["harborline-model".to_string()]);
    }

    #[test]
    fn logged_out_returns_the_refusal_detail() {
        let fake = FakeCli::stage("logged-out");
        let result = result_of(
            Instant::now(),
            cursor_test(&fake.binary("cursor-agent"), TEST_TIMEOUT),
        );
        assert!(!result.ok);
        assert_eq!(result.outcome, ConnectionOutcome::Refused);
        assert!(result.detail.contains("Not logged in"));
        assert!(result.models.is_empty());
    }

    #[test]
    fn a_slow_test_times_out_and_reaps_the_cli() {
        let fake = FakeCli::stage("slow");
        let binary = fake.binary("cursor-agent");
        let result = cursor_test(&binary, Duration::from_millis(1500));
        assert_eq!(result, Probed::TimedOut { secs: 1 });
        let reported = result_of(Instant::now(), result);
        assert_eq!(reported.outcome, ConnectionOutcome::TimedOut);
        assert_eq!(reported.secs, Some(1));
        assert!(reported.detail.is_empty());
        let pid = std::fs::read_to_string(
            std::path::Path::new(&binary)
                .parent()
                .unwrap()
                .join("probe.pid"),
        )
        .unwrap();
        let output = std::process::Command::new("ps")
            .args(["-o", "stat=", "-p", pid.trim()])
            .output()
            .unwrap();
        assert!(String::from_utf8_lossy(&output.stdout).trim().is_empty());
    }

    #[test]
    fn model_listing_edges() {
        for text in [
            "",
            " \n",
            "Available models\n\nTip: use --model",
            "```\nmodel\n```",
            "```\nAvailable models\nharborline-model\n```",
            "Available models\nUnexpected banner",
            "No models available for this account.",
        ] {
            assert!(listed_models(text).is_empty());
        }
        assert!(listed_models(&"x".repeat(100_000)).is_empty());
        assert!(listed_models(&format!("Available models\n{}", "x".repeat(100_000))).is_empty());
        assert_eq!(
            listed_models("Available models\n\u{1b}[36mharborline-model\u{1b}[0m - Harborline\nharborline-model - Harborline"),
            vec!["harborline-model".to_string()],
        );
    }

    #[test]
    fn the_listing_keeps_every_model_the_account_lists() {
        let listed = listed_models(
            "Loading models\nAvailable models\n\nauto - Auto\nclaude-sonnet-5-5-high - Sonnet 5.5\ncomposer-2.5 - Composer 2.5\n\nTip: use --model <id> to switch.\nnorthwind-model - Ignored",
        );
        assert_eq!(
            listed,
            vec![
                "auto".to_string(),
                "claude-sonnet-5-5-high".to_string(),
                "composer-2.5".to_string(),
            ],
        );
    }

    #[test]
    fn an_oversized_listing_counts_as_unparsed() {
        let lines: Vec<String> = (0..=MAX_LISTED_MODELS)
            .map(|index| format!("acme-model-{index} - Acme"))
            .collect();
        let text = format!("Available models\n{}", lines.join("\n"));
        assert!(listed_models(&text).is_empty());
    }
}
