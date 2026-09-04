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
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
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
pub async fn secret_set(key: String, value: String) -> Result<(), SecretError> {
    tauri::async_runtime::spawn_blocking(move || set(&key, &value))
        .await
        .map_err(|e| SecretError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn secret_delete(key: String) -> Result<(), SecretError> {
    tauri::async_runtime::spawn_blocking(move || clear(&key))
        .await
        .map_err(|e| SecretError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests {
    const LIB_SRC: &str = include_str!("lib.rs");
    const TAURI_CONF: &str = include_str!("../tauri.conf.json");

    fn csp() -> String {
        let conf: serde_json::Value = serde_json::from_str(TAURI_CONF).expect("tauri.conf.json");
        conf["app"]["security"]["csp"]
            .as_str()
            .expect("app.security.csp")
            .to_string()
    }

    fn directive(name: &str) -> String {
        csp()
            .split(';')
            .map(str::trim)
            .find(|part| part.starts_with(name))
            .unwrap_or_else(|| panic!("{name} directive missing"))
            .to_string()
    }

    #[test]
    fn keychain_read_commands_are_not_exposed_to_the_webview() {
        assert!(!LIB_SRC.contains("secret_get"));
        assert!(!LIB_SRC.contains("secret_has"));
    }

    #[test]
    fn keychain_write_commands_stay_exposed_to_the_webview() {
        assert!(LIB_SRC.contains("secrets::secret_set"));
        assert!(LIB_SRC.contains("secrets::secret_delete"));
    }

    #[test]
    fn connect_src_grants_no_remote_origin() {
        assert_eq!(
            directive("connect-src"),
            "connect-src 'self' ipc: http://ipc.localhost"
        );
    }

    #[test]
    fn img_src_stays_local_only() {
        assert_eq!(directive("img-src"), "img-src 'self' data:");
    }
}
