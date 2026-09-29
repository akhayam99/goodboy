pub(crate) fn iso_now() -> String {
    let secs = now_secs() as i64;
    let (year, month, day, hour, min, sec) = epoch_secs_to_datetime(secs);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, min, sec
    )
}

pub(crate) fn now_secs() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

pub(crate) fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

pub(crate) fn ms_to_iso(ms: i64) -> String {
    let secs = ms.div_euclid(1000);
    let millis = ms.rem_euclid(1000);
    let (year, month, day, hour, min, sec) = epoch_secs_to_datetime(secs);
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{min:02}:{sec:02}.{millis:03}Z")
}

pub(crate) fn iso_now_whole_seconds() -> String {
    whole_seconds_stamp(now_ms())
}

fn whole_seconds_stamp(ms: i64) -> String {
    ms_to_iso(ms.div_euclid(1000) * 1000)
}

pub(crate) fn optional_ms_to_iso(ms: Option<i64>) -> Option<String> {
    ms.map(ms_to_iso)
}

pub(crate) fn iso_to_ms(value: &str) -> Option<i64> {
    if value.len() < 19 {
        return None;
    }
    let year: i64 = value.get(0..4)?.parse().ok()?;
    let month: u32 = value.get(5..7)?.parse().ok()?;
    let day: u32 = value.get(8..10)?.parse().ok()?;
    let hour: i64 = value.get(11..13)?.parse().ok()?;
    let minute: i64 = value.get(14..16)?.parse().ok()?;
    let second: i64 = value.get(17..19)?.parse().ok()?;
    let millis = value
        .get(19..)
        .and_then(|suffix| suffix.strip_prefix('.'))
        .map(|fraction| {
            fraction
                .chars()
                .take_while(|character| character.is_ascii_digit())
                .take(3)
                .collect::<String>()
        })
        .filter(|fraction| !fraction.is_empty())
        .and_then(|fraction| format!("{fraction:0<3}").parse::<i64>().ok())
        .unwrap_or(0);
    Some(
        ymd_to_epoch_ms(year, month, day)
            + hour * 3_600_000
            + minute * 60_000
            + second * 1000
            + millis,
    )
}

fn is_leap_year(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

fn days_in_month(y: i64, m: u32) -> i64 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if is_leap_year(y) {
                29
            } else {
                28
            }
        }
        _ => unreachable!(),
    }
}

pub(crate) fn epoch_secs_to_datetime(mut s: i64) -> (i64, u32, u32, u32, u32, u32) {
    let sec = (s % 60) as u32;
    s /= 60;
    let min = (s % 60) as u32;
    s /= 60;
    let hour = (s % 24) as u32;
    s /= 24;
    let mut year: i64 = 1970;
    loop {
        let days = if is_leap_year(year) { 366 } else { 365 };
        if s < days {
            break;
        }
        s -= days;
        year += 1;
    }
    let mut month: u32 = 1;
    loop {
        let d = days_in_month(year, month);
        if s < d {
            break;
        }
        s -= d;
        month += 1;
    }
    let day = s as u32 + 1;
    (year, month, day, hour, min, sec)
}

pub(crate) fn epoch_seconds_to_year_month(mut s: i64) -> (i64, u32) {
    let mut year: i64 = 1970;
    loop {
        let days = if is_leap_year(year) { 366 } else { 365 };
        let secs = days * 86400;
        if s < secs {
            break;
        }
        s -= secs;
        year += 1;
    }
    let mut month: u32 = 1;
    loop {
        let secs = days_in_month(year, month) * 86400;
        if s < secs {
            break;
        }
        s -= secs;
        month += 1;
    }
    (year, month)
}

pub(crate) fn ymd_to_epoch_ms(year: i64, month: u32, day: u32) -> i64 {
    let mut days: i64 = 0;
    for y in 1970..year {
        days += if is_leap_year(y) { 366 } else { 365 };
    }
    for m in 1..month {
        days += days_in_month(year, m);
    }
    days += day as i64 - 1;
    days * 86400 * 1000
}

#[cfg(test)]
mod tests {
    use super::*;

    const DAY_MS: i64 = 86_400_000;

    #[test]
    fn ms_to_iso_matches_known_calendar_dates() {
        assert_eq!(ms_to_iso(0), "1970-01-01T00:00:00.000Z");
        assert_eq!(ms_to_iso(10_957 * DAY_MS), "2000-01-01T00:00:00.000Z");
        assert_eq!(ms_to_iso(18_321 * DAY_MS), "2020-02-29T00:00:00.000Z");
        assert_eq!(
            ms_to_iso(18_321 * DAY_MS + 3_723_456),
            "2020-02-29T01:02:03.456Z"
        );
    }

    #[test]
    fn iso_to_ms_reads_back_what_ms_to_iso_wrote() {
        let ms = 18_321 * DAY_MS + 3_723_456;
        assert_eq!(iso_to_ms(&ms_to_iso(ms)), Some(ms));
        assert_eq!(iso_to_ms("2000-01-01T00:00:00Z"), Some(10_957 * DAY_MS));
        assert_eq!(iso_to_ms("not a date"), None);
    }

    #[test]
    fn whole_seconds_stamp_drops_the_millis() {
        assert_eq!(
            whole_seconds_stamp(18_321 * DAY_MS + 3_723_999),
            "2020-02-29T01:02:03.000Z"
        );
        assert_eq!(whole_seconds_stamp(999), "1970-01-01T00:00:00.000Z");
    }

    #[test]
    fn whole_second_stamp_ends_in_three_zero_millis() {
        let stamp = iso_now_whole_seconds();
        assert_eq!(stamp.len(), 24, "unexpected format: {stamp}");
        assert!(stamp.ends_with(".000Z"), "missing zero millis: {stamp}");
        let year: i64 = stamp[0..4].parse().expect("year");
        assert!(year >= 2025, "year looks wrong: {stamp}");
    }

    #[test]
    fn second_stamp_has_no_millis() {
        let stamp = iso_now();
        assert_eq!(stamp.len(), 20, "unexpected format: {stamp}");
        assert!(stamp.ends_with('Z'));
        assert!(!stamp.contains('.'));
    }

    #[test]
    fn now_secs_and_now_ms_agree_on_the_second() {
        let before = now_secs() as i64;
        let ms = now_ms();
        let after = now_secs() as i64;
        assert!(ms / 1000 >= before && ms / 1000 <= after);
    }
}
