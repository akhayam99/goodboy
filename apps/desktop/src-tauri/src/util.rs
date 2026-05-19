//! Shared helpers used by multiple Tauri command modules.
//!
//! These functions used to be copy-pasted into every module that needed an
//! ISO timestamp or a UUID. Keeping a single implementation here removes the
//! drift risk (e.g. divergent `days_in_month` fallbacks between modules) and
//! shrinks the surface for clock / RNG behaviour changes.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use sha2::{Digest, Sha256};

/// Generates an RFC 4122 v4 UUID derived from a SHA-256 hash of
/// `(monotonic_counter, pid, nanos)`. Good enough for local DB keys; not a
/// cryptographic identifier.
pub fn uuid_v4() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let t = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let pid = std::process::id();
    let seq = COUNTER.fetch_add(1, Ordering::Relaxed);
    let input = format!("{}-{}-{}", t.as_nanos(), pid, seq);
    let hash = Sha256::digest(input.as_bytes());
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-4{:01x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        hash[0],
        hash[1],
        hash[2],
        hash[3],
        hash[4],
        hash[5],
        hash[6] & 0x0f,
        hash[7],
        (hash[8] & 0x3f) | 0x80,
        hash[9],
        hash[10],
        hash[11],
        hash[12],
        hash[13],
        hash[14],
        hash[15],
    )
}

/// ISO-8601 timestamp at second resolution, UTC.
pub fn iso_now() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let (year, month, day, hour, min, sec) = epoch_secs_to_datetime(secs);
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{min:02}:{sec:02}Z")
}

/// Formats a millisecond epoch column (as stored in SQLite INTEGER columns)
/// to the same ISO-8601 shape as [`iso_now`].
pub fn ms_col_to_iso(ms: i64) -> String {
    let secs = ms / 1000;
    let (year, month, day, hour, min, sec) = epoch_secs_to_datetime(secs);
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{min:02}:{sec:02}Z")
}

pub fn is_leap_year(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

pub fn days_in_month(y: i64, m: u32) -> i64 {
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
        // Hand-rolled calendar math: caller is internal and always passes 1..=12.
        // `unreachable!` makes a logic bug here loud rather than silently coercing
        // to a wrong month length (which previous duplicates of this fn sometimes did).
        _ => unreachable!("invalid month: {m}"),
    }
}

/// Splits a UNIX-epoch second count into (year, month, day, hour, min, sec)
/// using proleptic Gregorian rules from 1970-01-01 forward.
pub fn epoch_secs_to_datetime(mut s: i64) -> (i64, u32, u32, u32, u32, u32) {
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
