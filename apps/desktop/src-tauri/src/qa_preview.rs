const DECIDING_RUNS_ENV: &str = "GOODBOY_QA_DECIDING_RUNS";

fn parse_run_ids(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .collect()
}

#[tauri::command]
pub fn qa_deciding_workflow_runs() -> Vec<String> {
    match std::env::var(DECIDING_RUNS_ENV) {
        Ok(raw) => parse_run_ids(&raw),
        Err(_) => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::parse_run_ids;

    #[test]
    fn reads_nothing_from_an_empty_value() {
        assert!(parse_run_ids("").is_empty());
        assert!(parse_run_ids("  ,  ").is_empty());
    }

    #[test]
    fn reads_every_trimmed_run_id() {
        assert_eq!(
            parse_run_ids(" run-1 , run-2,run-3 "),
            vec![
                "run-1".to_string(),
                "run-2".to_string(),
                "run-3".to_string()
            ]
        );
    }
}
