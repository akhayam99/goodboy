use serde::Serialize;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CodexRolloutContext {
    pub context_tokens: u64,
    pub context_window: Option<u64>,
}

fn codex_home() -> Option<PathBuf> {
    if let Ok(dir) = std::env::var("CODEX_HOME") {
        if !dir.is_empty() {
            return Some(PathBuf::from(dir));
        }
    }
    Some(dirs::home_dir()?.join(".codex"))
}

fn sorted_children_desc(dir: &Path) -> Vec<PathBuf> {
    let mut children: Vec<PathBuf> = match std::fs::read_dir(dir) {
        Ok(entries) => entries
            .filter_map(|entry| entry.ok().map(|e| e.path()))
            .collect(),
        Err(_) => Vec::new(),
    };
    children.sort();
    children.reverse();
    children
}

fn find_rollout(sessions_dir: &Path, thread_id: &str) -> Option<PathBuf> {
    let suffix = format!("-{thread_id}.jsonl");
    let mut stack = vec![sessions_dir.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let children = sorted_children_desc(&dir);
        for child in children.iter() {
            let is_match = child
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("rollout-") && name.ends_with(&suffix));
            if is_match {
                return Some(child.clone());
            }
        }
        for child in children.into_iter().rev() {
            if child.is_dir() {
                stack.push(child);
            }
        }
    }
    None
}

fn context_from_line(line: &str) -> Option<CodexRolloutContext> {
    if !line.contains("\"last_token_usage\"") {
        return None;
    }
    let value: serde_json::Value = serde_json::from_str(line).ok()?;
    let info = value.get("payload")?.get("info")?;
    let last = info.get("last_token_usage")?;
    let total = last.get("total_tokens").and_then(|v| v.as_u64());
    let context_tokens = match total {
        Some(total) => total,
        None => {
            let input = last.get("input_tokens").and_then(|v| v.as_u64())?;
            let output = last
                .get("output_tokens")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            input + output
        }
    };
    Some(CodexRolloutContext {
        context_tokens,
        context_window: info.get("model_context_window").and_then(|v| v.as_u64()),
    })
}

const TAIL_CHUNK: u64 = 64 * 1024;

fn context_from_bytes(line: &[u8]) -> Option<CodexRolloutContext> {
    context_from_line(std::str::from_utf8(line).ok()?)
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CodexRateLimitsReading {
    pub observed_at: Option<String>,
    pub rate_limits: serde_json::Value,
}

fn rate_limits_from_line(line: &str) -> Option<CodexRateLimitsReading> {
    if !line.contains("\"rate_limits\"") {
        return None;
    }
    let value: serde_json::Value = serde_json::from_str(line).ok()?;
    let rate_limits = value.get("payload")?.get("rate_limits")?;
    if !rate_limits.is_object() {
        return None;
    }
    let has_window = ["primary", "secondary"].iter().any(|key| {
        rate_limits
            .get(key)
            .is_some_and(|window| window.is_object())
    });
    if !has_window {
        return None;
    }
    Some(CodexRateLimitsReading {
        observed_at: value
            .get("timestamp")
            .and_then(|v| v.as_str())
            .map(String::from),
        rate_limits: rate_limits.clone(),
    })
}

fn rate_limits_from_bytes(line: &[u8]) -> Option<CodexRateLimitsReading> {
    rate_limits_from_line(std::str::from_utf8(line).ok()?)
}

fn last_context<R: Read + Seek>(reader: R) -> Option<CodexRolloutContext> {
    last_match(reader, context_from_bytes)
}

fn last_rate_limits<R: Read + Seek>(reader: R) -> Option<CodexRateLimitsReading> {
    last_match(reader, rate_limits_from_bytes)
}

fn is_rollout_file(path: &Path) -> bool {
    path.is_file()
        && path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with("rollout-") && name.ends_with(".jsonl"))
}

fn collect_newest_rollouts(dir: &Path, limit: usize, found: &mut Vec<PathBuf>) {
    for child in sorted_children_desc(dir) {
        if found.len() >= limit {
            return;
        }
        if child.is_dir() {
            collect_newest_rollouts(&child, limit, found);
            continue;
        }
        if is_rollout_file(&child) {
            found.push(child);
        }
    }
}

fn newest_rollouts(sessions_dir: &Path, limit: usize) -> Vec<PathBuf> {
    let mut found = Vec::new();
    collect_newest_rollouts(sessions_dir, limit, &mut found);
    found
}

const LATEST_ROLLOUTS_SCANNED: usize = 5;

fn latest_rate_limits(sessions_dir: &Path) -> Option<CodexRateLimitsReading> {
    newest_rollouts(sessions_dir, LATEST_ROLLOUTS_SCANNED)
        .into_iter()
        .filter_map(|path| last_rate_limits(File::open(path).ok()?))
        .max_by(|left, right| left.observed_at.cmp(&right.observed_at))
}

#[tauri::command]
pub async fn codex_rate_limits_latest() -> Option<CodexRateLimitsReading> {
    tauri::async_runtime::spawn_blocking(|| latest_rate_limits(&codex_home()?.join("sessions")))
        .await
        .ok()
        .flatten()
}

fn last_match<R: Read + Seek, T>(mut reader: R, read_line: fn(&[u8]) -> Option<T>) -> Option<T> {
    let mut end = reader.seek(SeekFrom::End(0)).ok()?;
    let mut carry: Vec<u8> = Vec::new();
    while end > 0 {
        let start = end.saturating_sub(TAIL_CHUNK);
        let mut chunk = vec![0u8; (end - start) as usize];
        reader.seek(SeekFrom::Start(start)).ok()?;
        reader.read_exact(&mut chunk).ok()?;
        chunk.extend_from_slice(&carry);
        let mut lines = chunk.split(|byte| *byte == b'\n').collect::<Vec<_>>();
        let head = if start > 0 {
            lines.remove(0).to_vec()
        } else {
            Vec::new()
        };
        if let Some(found) = lines.iter().rev().find_map(|line| read_line(line)) {
            return Some(found);
        }
        carry = head;
        end = start;
    }
    None
}

fn rollout_context(thread_id: &str) -> Option<CodexRolloutContext> {
    let is_safe_id = !thread_id.is_empty()
        && thread_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-');
    if !is_safe_id {
        return None;
    }
    let path = find_rollout(&codex_home()?.join("sessions"), thread_id)?;
    last_context(File::open(path).ok()?)
}

#[tauri::command]
pub async fn codex_rollout_context(thread_id: String) -> Option<CodexRolloutContext> {
    tauri::async_runtime::spawn_blocking(move || rollout_context(&thread_id))
        .await
        .ok()
        .flatten()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    const TOKEN_COUNT_EARLY: &str = r#"{"type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":1000,"output_tokens":10,"total_tokens":1010},"last_token_usage":{"input_tokens":1000,"output_tokens":10,"total_tokens":1010},"model_context_window":258400}}}"#;
    const TOKEN_COUNT_LATE: &str = r#"{"type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":29731235,"output_tokens":62215,"total_tokens":29793450},"last_token_usage":{"input_tokens":51858,"output_tokens":3754,"total_tokens":55612},"model_context_window":258400}}}"#;
    const TOKEN_COUNT_EMPTY: &str =
        r#"{"type":"event_msg","payload":{"type":"token_count","info":null}}"#;

    #[test]
    fn reads_the_last_request_not_the_turn_total() {
        let rollout = [TOKEN_COUNT_EARLY, TOKEN_COUNT_LATE, TOKEN_COUNT_EMPTY].join("\n");
        assert_eq!(
            last_context(Cursor::new(rollout)),
            Some(CodexRolloutContext {
                context_tokens: 55612,
                context_window: Some(258400),
            })
        );
    }

    #[test]
    fn reads_the_last_request_across_chunk_boundaries() {
        let filler = format!(
            "{{\"type\":\"response_item\",\"text\":\"{}\"}}",
            "x".repeat(200_000)
        );
        let rollout = [TOKEN_COUNT_EARLY, &filler, TOKEN_COUNT_LATE, &filler].join("\n");
        assert_eq!(
            last_context(Cursor::new(rollout)).map(|c| c.context_tokens),
            Some(55612)
        );
        let only_early = [TOKEN_COUNT_EARLY, &filler, &filler].join("\n");
        assert_eq!(
            last_context(Cursor::new(only_early)).map(|c| c.context_tokens),
            Some(1010)
        );
    }

    #[test]
    fn answers_none_without_token_counts() {
        assert_eq!(last_context(Cursor::new(TOKEN_COUNT_EMPTY)), None);
    }

    #[test]
    fn finds_the_rollout_of_a_thread_in_nested_date_folders() {
        let root = std::env::temp_dir().join(format!("gb-rollout-{}", std::process::id()));
        let day = root.join("2026").join("09").join("23");
        std::fs::create_dir_all(&day).unwrap();
        let wanted = day.join("rollout-2026-09-23T10-00-00-thread-abc.jsonl");
        std::fs::write(&wanted, TOKEN_COUNT_LATE).unwrap();
        std::fs::write(day.join("rollout-2026-09-23T09-00-00-thread-xyz.jsonl"), "").unwrap();

        assert_eq!(find_rollout(&root, "thread-abc"), Some(wanted));
        assert_eq!(find_rollout(&root, "thread-missing"), None);
        std::fs::remove_dir_all(&root).unwrap();
    }

    const TOKEN_COUNT_WITH_LIMITS: &str = r#"{"timestamp":"2026-09-25T10:59:20.919Z","type":"event_msg","payload":{"type":"token_count","info":{"last_token_usage":{"input_tokens":21578,"output_tokens":222,"total_tokens":21800},"model_context_window":258400},"rate_limits":{"limit_id":"codex","primary":{"used_percent":0.0,"window_minutes":300,"resets_at":1790351955},"secondary":{"used_percent":100.0,"window_minutes":10080,"resets_at":1790458728},"plan_type":"plus","rate_limit_reached_type":null}}}"#;
    const TOKEN_COUNT_OLDER_LIMITS: &str = r#"{"timestamp":"2026-09-24T08:00:00.000Z","type":"event_msg","payload":{"type":"token_count","info":null,"rate_limits":{"limit_id":"codex","primary":{"used_percent":40.0,"window_minutes":300,"resets_at":1790200000},"plan_type":"plus"}}}"#;

    #[test]
    fn reads_the_last_rate_limits_of_a_rollout() {
        let rollout = [TOKEN_COUNT_WITH_LIMITS, TOKEN_COUNT_EMPTY].join("\n");
        let reading = last_rate_limits(Cursor::new(rollout)).unwrap();
        assert_eq!(
            reading.observed_at.as_deref(),
            Some("2026-09-25T10:59:20.919Z")
        );
        assert_eq!(
            reading.rate_limits["secondary"]["used_percent"].as_f64(),
            Some(100.0)
        );
        assert_eq!(
            last_rate_limits(Cursor::new(TOKEN_COUNT_LATE.to_string())),
            None
        );
    }

    const TOKEN_COUNT_PREMIUM_EMPTY: &str = r#"{"timestamp":"2026-09-25T10:59:21.000Z","type":"event_msg","payload":{"type":"token_count","info":null,"rate_limits":{"limit_id":"premium","primary":null,"secondary":null,"plan_type":"plus"}}}"#;

    #[test]
    fn skips_a_trailing_bucket_with_no_windows() {
        let rollout = [TOKEN_COUNT_WITH_LIMITS, TOKEN_COUNT_PREMIUM_EMPTY].join("\n");
        let reading = last_rate_limits(Cursor::new(rollout)).unwrap();
        assert_eq!(reading.rate_limits["limit_id"].as_str(), Some("codex"));
        assert_eq!(
            reading.rate_limits["primary"]["window_minutes"].as_i64(),
            Some(300)
        );
        assert_eq!(
            last_rate_limits(Cursor::new(TOKEN_COUNT_PREMIUM_EMPTY.to_string())),
            None
        );
    }

    #[test]
    fn picks_the_newest_rate_limits_across_the_latest_rollouts() {
        let root = std::env::temp_dir().join(format!("gb-rate-limits-{}", std::process::id()));
        let older_day = root.join("2026").join("09").join("24");
        let newer_day = root.join("2026").join("09").join("25");
        std::fs::create_dir_all(&older_day).unwrap();
        std::fs::create_dir_all(&newer_day).unwrap();
        std::fs::write(
            older_day.join("rollout-2026-09-24T08-00-00-thread-old.jsonl"),
            TOKEN_COUNT_OLDER_LIMITS,
        )
        .unwrap();
        std::fs::write(
            newer_day.join("rollout-2026-09-25T10-00-00-thread-new.jsonl"),
            TOKEN_COUNT_WITH_LIMITS,
        )
        .unwrap();
        std::fs::write(
            newer_day.join("rollout-2026-09-25T11-00-00-thread-empty.jsonl"),
            TOKEN_COUNT_LATE,
        )
        .unwrap();

        assert_eq!(newest_rollouts(&root, 2).len(), 2);
        assert_eq!(
            latest_rate_limits(&root).and_then(|reading| reading.observed_at),
            Some("2026-09-25T10:59:20.919Z".to_string())
        );
        std::fs::remove_dir_all(&root).unwrap();
        assert_eq!(latest_rate_limits(&root), None);
    }

    #[test]
    fn refuses_a_thread_id_that_could_escape_the_sessions_folder() {
        assert_eq!(rollout_context("../../etc/passwd"), None);
        assert_eq!(rollout_context(""), None);
    }
}
