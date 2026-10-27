pub(super) const SESSION_WARN_PCT: f64 = 80.0;

const MAX_UTC_OFFSET_MINUTES: i32 = 14 * 60;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Standing {
    Clear,
    Near,
    Over,
}

pub(super) fn spend_pct(spent: f64, cap: f64) -> f64 {
    if cap <= 0.0 {
        return 100.0;
    }
    (spent / cap) * 100.0
}

pub(super) fn classify_spend(spent: f64, cap: f64, warn_pct: f64) -> Standing {
    let pct = spend_pct(spent, cap);
    if pct >= 100.0 {
        return Standing::Over;
    }
    if pct >= warn_pct {
        return Standing::Near;
    }
    Standing::Clear
}

fn next_month_of(year: i64, month: u32) -> (i64, u32) {
    if month == 12 {
        return (year + 1, 1);
    }
    (year, month + 1)
}

#[derive(Debug, Clone, Copy)]
pub(super) struct SpendClock {
    pub now_ms: i64,
    utc_offset_ms: i64,
}

impl SpendClock {
    pub(super) fn at(now_ms: i64, utc_offset_minutes: i32) -> Self {
        let minutes = utc_offset_minutes.clamp(-MAX_UTC_OFFSET_MINUTES, MAX_UTC_OFFSET_MINUTES);
        Self {
            now_ms,
            utc_offset_ms: i64::from(minutes) * 60_000,
        }
    }

    pub(super) fn now(utc_offset_minutes: i32) -> Self {
        Self::at(crate::util::now_ms(), utc_offset_minutes)
    }

    pub(super) fn month_window_ms(&self) -> (i64, i64) {
        let local_now_ms = self.now_ms + self.utc_offset_ms;
        let (year, month) = crate::util::epoch_seconds_to_year_month(local_now_ms / 1000);
        let (next_year, next_month) = next_month_of(year, month);
        let start_ms = crate::util::ymd_to_epoch_ms(year, month, 1) - self.utc_offset_ms;
        let end_ms =
            crate::util::ymd_to_epoch_ms(next_year, next_month, 1) - self.utc_offset_ms - 1;
        (start_ms, end_ms)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ms(year: i64, month: u32, day: u32) -> i64 {
        crate::util::ymd_to_epoch_ms(year, month, day)
    }

    #[test]
    fn spend_equal_to_the_cap_is_over() {
        assert_eq!(classify_spend(100.0, 100.0, 80.0), Standing::Over);
        assert_eq!(classify_spend(99.99, 100.0, 80.0), Standing::Near);
    }

    #[test]
    fn the_warn_point_is_inclusive_and_moves_with_the_threshold() {
        assert_eq!(classify_spend(80.0, 100.0, 80.0), Standing::Near);
        assert_eq!(classify_spend(79.9, 100.0, 80.0), Standing::Clear);
        assert_eq!(classify_spend(50.0, 100.0, 50.0), Standing::Near);
    }

    #[test]
    fn a_cap_of_zero_is_over_whatever_was_spent() {
        assert_eq!(classify_spend(0.0, 0.0, 80.0), Standing::Over);
        assert_eq!(classify_spend(5.0, 0.0, 80.0), Standing::Over);
        assert_eq!(spend_pct(5.0, 0.0), 100.0);
    }

    #[test]
    fn the_session_warn_point_is_eighty_percent() {
        assert_eq!(SESSION_WARN_PCT, 80.0);
        assert_eq!(classify_spend(7.9, 10.0, SESSION_WARN_PCT), Standing::Clear);
        assert_eq!(classify_spend(8.0, 10.0, SESSION_WARN_PCT), Standing::Near);
    }

    #[test]
    fn utc_clock_keeps_the_month_on_the_utc_calendar() {
        let (start, end) = SpendClock::at(ms(2026, 10, 1) - 1, 0).month_window_ms();

        assert_eq!(start, ms(2026, 9, 1));
        assert_eq!(end, ms(2026, 10, 1) - 1);
    }

    #[test]
    fn half_past_midnight_local_on_the_first_opens_the_new_month() {
        let local_half_past_midnight = ms(2026, 10, 1) - 90 * 60_000;

        let (start, end) = SpendClock::at(local_half_past_midnight, 120).month_window_ms();

        assert_eq!(start, ms(2026, 10, 1) - 120 * 60_000);
        assert_eq!(end, ms(2026, 11, 1) - 120 * 60_000 - 1);
    }

    #[test]
    fn west_of_utc_the_last_evening_of_the_month_still_belongs_to_it() {
        let local_evening = ms(2026, 10, 1) + 60 * 60_000;

        let (start, end) = SpendClock::at(local_evening, -300).month_window_ms();

        assert_eq!(start, ms(2026, 9, 1) + 300 * 60_000);
        assert_eq!(end, ms(2026, 10, 1) + 300 * 60_000 - 1);
    }

    #[test]
    fn december_rolls_into_january_on_the_local_calendar() {
        let (start, end) = SpendClock::at(ms(2026, 12, 15), 60).month_window_ms();

        assert_eq!(start, ms(2026, 12, 1) - 60 * 60_000);
        assert_eq!(end, ms(2027, 1, 1) - 60 * 60_000 - 1);
    }

    #[test]
    fn an_offset_past_fourteen_hours_is_clamped() {
        let wild = SpendClock::at(ms(2026, 10, 15), 5_000).month_window_ms();
        let widest = SpendClock::at(ms(2026, 10, 15), 840).month_window_ms();

        assert_eq!(wild, widest);
    }
}
