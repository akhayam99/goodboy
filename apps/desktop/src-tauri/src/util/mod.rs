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

mod encoding;
mod ids;
mod time;

pub(crate) use encoding::percent_encode;
pub(crate) use ids::uuid_v4;
pub(crate) use time::{
    epoch_seconds_to_year_month, epoch_secs_to_datetime, iso_now, iso_now_whole_seconds, iso_to_ms,
    ms_to_iso, now_ms, now_secs, optional_ms_to_iso, ymd_to_epoch_ms,
};

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
