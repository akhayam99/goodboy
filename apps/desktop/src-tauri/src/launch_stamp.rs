use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

static LAUNCHED_AT_MS: OnceLock<u64> = OnceLock::new();

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX))
        .unwrap_or(0)
}

fn launched_at_ms() -> u64 {
    *LAUNCHED_AT_MS.get_or_init(now_ms)
}

pub fn record() {
    launched_at_ms();
}

#[tauri::command(async)]
pub fn process_launch_stamp() -> u64 {
    launched_at_ms()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_stamp_is_fixed_after_the_first_read() {
        let first = process_launch_stamp();
        std::thread::sleep(std::time::Duration::from_millis(5));
        assert_eq!(process_launch_stamp(), first);
    }

    #[test]
    fn the_stamp_is_a_recent_time_in_milliseconds() {
        let stamp = process_launch_stamp();
        let now = now_ms();
        assert!(stamp > 1_700_000_000_000);
        assert!(stamp <= now);
    }
}
