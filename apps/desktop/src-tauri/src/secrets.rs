use keyring::Entry;
use thiserror::Error;

const SERVICE: &str = "am.kay.desktop";

#[derive(Debug, Error)]
pub enum SecretError {
    #[error("keyring backend error: {0}")]
    Backend(#[from] keyring::Error),
}

impl serde::Serialize for SecretError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

fn entry(key: &str) -> Result<Entry, SecretError> {
    Ok(Entry::new(SERVICE, key)?)
}

pub fn read(key: &str) -> Result<Option<String>, SecretError> {
    match entry(key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(err.into()),
    }
}

#[tauri::command]
pub fn secret_set(key: String, value: String) -> Result<(), SecretError> {
    entry(&key)?.set_password(&value)?;
    Ok(())
}

#[tauri::command]
pub fn secret_delete(key: String) -> Result<(), SecretError> {
    match entry(&key)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(err.into()),
    }
}

#[tauri::command]
pub fn secret_has(key: String) -> Result<bool, SecretError> {
    Ok(read(&key)?.is_some())
}
