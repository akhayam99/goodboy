use keyring::Entry;
use thiserror::Error;

#[cfg(all(target_os = "macos", not(feature = "secret-store-apple")))]
compile_error!("keyring/apple-native is off, so macOS falls back to keyring's in-memory mock store and every saved credential disappears when the app exits");

#[cfg(all(target_os = "linux", not(feature = "secret-store-secret-service")))]
compile_error!("keyring/sync-secret-service is off, so Linux falls back to the kernel keyutils store or the in-memory mock, neither of which keeps a credential across a restart");

#[cfg(all(target_os = "linux", not(feature = "secret-store-encrypted-session")))]
compile_error!("keyring/crypto-rust is off, so the Secret Service session negotiates EncryptionType::Plain and every credential crosses the DBus session bus in cleartext");

#[cfg(all(target_os = "windows", not(feature = "secret-store-windows")))]
compile_error!("keyring/windows-native is off, so Windows falls back to keyring's in-memory mock store and every saved credential disappears when the app exits");

const SERVICE: &str = "com.goodboy.desktop";

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

pub fn set(key: &str, value: &str) -> Result<(), SecretError> {
    entry(key)?.set_password(value)?;
    Ok(())
}

pub fn clear(key: &str) -> Result<(), SecretError> {
    match entry(key)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(err.into()),
    }
}

#[tauri::command]
pub fn secret_set(key: String, value: String) -> Result<(), SecretError> {
    set(&key, &value)
}

#[tauri::command]
pub fn secret_delete(key: String) -> Result<(), SecretError> {
    clear(&key)
}

#[tauri::command]
pub fn secret_has(key: String) -> Result<bool, SecretError> {
    Ok(read(&key)?.is_some())
}

#[tauri::command]
pub fn secret_get(key: String) -> Result<Option<String>, SecretError> {
    read(&key)
}
