use super::error::CalendarError;

const KEY_PREFIX: &str = "goodboy.calendar.ics.";
const ID_LENGTH: usize = 32;

pub(crate) trait LinkVault: Send + Sync {
    fn save(&self, key: &str, link: &str) -> Result<(), CalendarError>;
    fn read(&self, key: &str) -> Result<Option<String>, CalendarError>;
    fn forget(&self, key: &str) -> Result<(), CalendarError>;
}

pub(crate) fn new_link_id() -> String {
    format!("{:032x}", rand::random::<u128>())
}

pub(crate) fn key_of(id: &str) -> Result<String, CalendarError> {
    let is_id = id.len() == ID_LENGTH
        && id
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte));
    if !is_id {
        return Err(CalendarError::Refused(
            "the calendar link id is not one Goodboy made".to_string(),
        ));
    }
    Ok(format!("{KEY_PREFIX}{id}"))
}

pub(crate) struct Keychain;

fn keychain_error(error: crate::secrets::SecretError) -> CalendarError {
    CalendarError::Keychain(error.to_string())
}

impl LinkVault for Keychain {
    fn save(&self, key: &str, link: &str) -> Result<(), CalendarError> {
        crate::secrets::set(key, link).map_err(keychain_error)
    }

    fn read(&self, key: &str) -> Result<Option<String>, CalendarError> {
        crate::secrets::read(key).map_err(keychain_error)
    }

    fn forget(&self, key: &str) -> Result<(), CalendarError> {
        crate::secrets::clear(key).map_err(keychain_error)
    }
}

#[cfg(test)]
pub(crate) mod test_support {
    use std::collections::HashMap;
    use std::sync::Mutex;

    use super::*;

    #[derive(Default)]
    pub(crate) struct FakeVault {
        pub entries: Mutex<HashMap<String, String>>,
        pub is_locked: bool,
    }

    impl FakeVault {
        pub(crate) fn holding(id: &str, link: &str) -> Self {
            let vault = Self::default();
            vault
                .entries
                .lock()
                .unwrap()
                .insert(key_of(id).unwrap(), link.to_string());
            vault
        }

        pub(crate) fn keys(&self) -> Vec<String> {
            let mut keys: Vec<String> = self.entries.lock().unwrap().keys().cloned().collect();
            keys.sort();
            keys
        }

        fn refuse_when_locked(&self) -> Result<(), CalendarError> {
            if self.is_locked {
                return Err(CalendarError::Keychain("locked".to_string()));
            }
            Ok(())
        }
    }

    impl LinkVault for FakeVault {
        fn save(&self, key: &str, link: &str) -> Result<(), CalendarError> {
            self.refuse_when_locked()?;
            self.entries
                .lock()
                .unwrap()
                .insert(key.to_string(), link.to_string());
            Ok(())
        }

        fn read(&self, key: &str) -> Result<Option<String>, CalendarError> {
            self.refuse_when_locked()?;
            Ok(self.entries.lock().unwrap().get(key).cloned())
        }

        fn forget(&self, key: &str) -> Result<(), CalendarError> {
            self.refuse_when_locked()?;
            self.entries.lock().unwrap().remove(key);
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_new_id_is_accepted_and_names_its_own_keychain_entry() {
        let id = new_link_id();
        assert_eq!(key_of(&id).unwrap(), format!("goodboy.calendar.ics.{id}"));
        assert_ne!(new_link_id(), id);
    }

    #[test]
    fn an_id_outside_the_grammar_is_refused_before_the_keychain() {
        for id in [
            "",
            "abc",
            "../../goodboy.credential.0123456789abcdef0123456789abcd",
            "0123456789ABCDEF0123456789ABCDEF",
            "0123456789abcdef0123456789abcdeg",
            "0123456789abcdef0123456789abcdef0",
        ] {
            assert!(matches!(key_of(id), Err(CalendarError::Refused(_))), "{id}");
        }
    }
}
