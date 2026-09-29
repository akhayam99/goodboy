macro_rules! impl_error_serialize {
    ($error:ty) => {
        impl serde::Serialize for $error {
            fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
                let mut map = serde_json::Map::new();
                map.insert(
                    "kind".to_string(),
                    serde_json::Value::String(self.kind().to_string()),
                );
                map.insert(
                    "message".to_string(),
                    serde_json::Value::String(self.to_string()),
                );
                serde::Serialize::serialize(&serde_json::Value::Object(map), serializer)
            }
        }
    };
}

pub(crate) use impl_error_serialize;

#[derive(Debug, thiserror::Error)]
pub(crate) enum MessageError {
    #[error("{0}")]
    Refused(String),
    #[error("{0}")]
    Failed(String),
}

impl MessageError {
    fn kind(&self) -> &'static str {
        match self {
            MessageError::Refused(_) => "refused",
            MessageError::Failed(_) => "failed",
        }
    }
}

impl From<String> for MessageError {
    fn from(message: String) -> Self {
        MessageError::Failed(message)
    }
}

impl From<&str> for MessageError {
    fn from(message: &str) -> Self {
        MessageError::Failed(message.to_string())
    }
}

impl_error_serialize!(MessageError);

pub(crate) fn uuid_v4() -> String {
    use sha2::{Digest, Sha256};
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let pid = std::process::id();
    static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let seq = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let input = format!("{}-{}-{}", t.as_nanos(), pid, seq);
    let hash = Sha256::digest(input.as_bytes());
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-4{:01x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        hash[0], hash[1], hash[2], hash[3],
        hash[4], hash[5],
        hash[6] & 0x0f, hash[7],
        (hash[8] & 0x3f) | 0x80, hash[9],
        hash[10], hash[11], hash[12], hash[13], hash[14], hash[15],
    )
}

pub(crate) fn iso_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let (year, month, day, hour, min, sec) = epoch_secs_to_datetime(secs);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, min, sec
    )
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

pub(crate) fn is_leap_year(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

pub(crate) fn days_in_month(y: i64, m: u32) -> i64 {
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
mod error_shape_tests {
    use super::MessageError;

    #[test]
    fn message_error_serializes_as_kind_and_message() {
        let refused = MessageError::Refused("not a usable release version".to_string());
        let failed: MessageError = "github responded 502".to_string().into();

        assert_eq!(
            serde_json::to_value(&refused).unwrap(),
            serde_json::json!({ "kind": "refused", "message": "not a usable release version" })
        );
        assert_eq!(
            serde_json::to_value(&failed).unwrap(),
            serde_json::json!({ "kind": "failed", "message": "github responded 502" })
        );
    }

    #[test]
    fn former_string_errors_serialize_as_kind_and_message() {
        let github = crate::github::GithubError::Timeout;
        let secret = crate::secrets::SecretError::Io(std::io::Error::other("disk full"));

        assert_eq!(
            serde_json::to_value(&github).unwrap()["kind"],
            serde_json::json!("timeout")
        );
        assert_eq!(
            serde_json::to_value(&secret).unwrap(),
            serde_json::json!({ "kind": "io", "message": "io error: disk full" })
        );
    }
}
