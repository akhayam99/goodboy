use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub(crate) enum CalendarError {
    #[error("{0}")]
    Refused(String),
    #[error("Goodboy has no access to the calendars on this Mac")]
    NoAccess,
    #[error("calendars on this Mac are only read on macOS")]
    Unsupported,
    #[error("{0}")]
    Fetch(String),
    #[error("{0}")]
    Parse(String),
    #[error("the Keychain refused the calendar link: {0}")]
    Keychain(String),
    #[error("{0}")]
    Failed(String),
}

impl CalendarError {
    fn kind(&self) -> &'static str {
        match self {
            CalendarError::Refused(_) => "refused",
            CalendarError::NoAccess => "no_access",
            CalendarError::Unsupported => "unsupported",
            CalendarError::Fetch(_) => "fetch",
            CalendarError::Parse(_) => "parse",
            CalendarError::Keychain(_) => "keychain",
            CalendarError::Failed(_) => "failed",
        }
    }
}

crate::util::impl_error_serialize!(CalendarError);

#[cfg(test)]
mod tests {
    use super::CalendarError;
    use crate::integrations::http::test_support::assert_error_shape;

    #[test]
    fn every_error_serializes_to_a_kind_and_a_message() {
        for (error, kind) in [
            (CalendarError::Refused("bad".to_string()), "refused"),
            (CalendarError::NoAccess, "no_access"),
            (CalendarError::Unsupported, "unsupported"),
            (CalendarError::Fetch("down".to_string()), "fetch"),
            (CalendarError::Parse("broken".to_string()), "parse"),
            (CalendarError::Keychain("locked".to_string()), "keychain"),
            (CalendarError::Failed("lost".to_string()), "failed"),
        ] {
            assert_error_shape(&error, kind);
        }
    }
}
