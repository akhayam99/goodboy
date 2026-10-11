use std::time::{Duration, Instant};

use serde::Serialize;

use crate::proc::probe;

const TEST_TIMEOUT: Duration = Duration::from_secs(15);

#[derive(Debug, Serialize)]
pub struct ConnectionTestResult {
    pub ok: bool,
    pub millis: u128,
    pub detail: String,
}

fn has_model(output: &str) -> bool {
    let clean = super::strip_ansi(output);
    let mut is_listing = false;
    for line in clean.lines().map(str::trim) {
        if line.starts_with("```") {
            return false;
        }
        if line == "Available models" {
            is_listing = true;
            continue;
        }
        if !is_listing || line.is_empty() {
            continue;
        }
        if line.starts_with("Tip:") {
            return false;
        }
        let id = line.split_whitespace().next().unwrap_or_default();
        if id.len() <= 256
            && id.starts_with(|c: char| c.is_ascii_lowercase())
            && id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || "-_.[],:=".contains(c))
        {
            return true;
        }
    }
    false
}

fn cursor_test(binary: &str, timeout: Duration) -> Result<String, String> {
    let mut command = crate::path_env::command(binary);
    command.arg("models");
    crate::aux_spawn::scrub_nested_session_env(&mut command);
    let output = probe::run(command, Instant::now() + timeout).map_err(|e| e.to_string())?;
    if output.timed_out {
        return Err("Probe timed out after 15 seconds".to_string());
    }
    if output.code == Some(0) && has_model(&output.stdout) {
        return Ok("Models answered".to_string());
    }
    let detail = output.primary_text();
    if detail.is_empty() {
        return Err("Cursor returned no models".to_string());
    }
    Err(super::strip_ansi(detail))
}

fn result_of(started: Instant, result: Result<String, String>) -> ConnectionTestResult {
    match result {
        Ok(detail) => ConnectionTestResult {
            ok: true,
            millis: started.elapsed().as_millis(),
            detail,
        },
        Err(detail) => ConnectionTestResult {
            ok: false,
            millis: started.elapsed().as_millis(),
            detail,
        },
    }
}

#[tauri::command]
pub async fn provider_test_connection(provider_id: String) -> ConnectionTestResult {
    let started = Instant::now();
    let result = match provider_id.as_str() {
        "cursor" => {
            tauri::async_runtime::spawn_blocking(|| cursor_test("cursor-agent", TEST_TIMEOUT))
                .await
                .unwrap_or_else(|e| Err(e.to_string()))
        }
        "anthropic" => crate::usage_probe::claude_usage_probe()
            .await
            .map(|_| "Usage answered".to_string())
            .map_err(|e| e.to_string()),
        "codex" => crate::codex_app_server::codex_rate_limits_probe(false)
            .await
            .map(|_| "Limits answered".to_string())
            .map_err(|e| e.to_string()),
        _ => Err("This provider has no account test".to_string()),
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
    }

    #[test]
    fn logged_out_returns_the_refusal_detail() {
        let fake = FakeCli::stage("logged-out");
        let result = result_of(
            Instant::now(),
            cursor_test(&fake.binary("cursor-agent"), TEST_TIMEOUT),
        );
        assert!(!result.ok);
        assert!(result.detail.contains("Not logged in"));
    }

    #[test]
    fn a_slow_test_times_out_and_reaps_the_cli() {
        let fake = FakeCli::stage("slow");
        let binary = fake.binary("cursor-agent");
        let result = cursor_test(&binary, Duration::from_millis(1500));
        assert!(result.expect_err("timeout").contains("timed out"));
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
            assert!(!has_model(text));
        }
        assert!(!has_model(&"x".repeat(100_000)));
        assert!(!has_model(&format!(
            "Available models\n{}",
            "x".repeat(100_000)
        )));
        assert!(has_model("Available models\n\u{1b}[36mharborline-model\u{1b}[0m - Harborline\nharborline-model - Harborline"));
    }
}
