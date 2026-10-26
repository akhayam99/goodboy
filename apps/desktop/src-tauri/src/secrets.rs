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
    #[error("secret key is outside the allowed grammar")]
    InvalidKey,
}

impl SecretError {
    fn kind(&self) -> &'static str {
        match self {
            SecretError::InvalidKey => "invalid_key",
            SecretError::Backend(_) => "backend",
            SecretError::Io(_) => "io",
        }
    }
}

crate::util::impl_error_serialize!(SecretError);

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

const WEBVIEW_KEY_PREFIX: &str = "provider_credential.";
const WEBVIEW_ID_MAX: usize = 64;

fn check_webview_key(key: &str) -> Result<(), SecretError> {
    let id = key
        .strip_prefix(WEBVIEW_KEY_PREFIX)
        .ok_or(SecretError::InvalidKey)?;
    let is_id = !id.is_empty()
        && id.len() <= WEBVIEW_ID_MAX
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    if !is_id {
        return Err(SecretError::InvalidKey);
    }
    Ok(())
}

#[tauri::command]
pub async fn secret_set(key: String, value: String) -> Result<(), SecretError> {
    check_webview_key(&key)?;
    tauri::async_runtime::spawn_blocking(move || set(&key, &value))
        .await
        .map_err(|e| SecretError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn secret_delete(key: String) -> Result<(), SecretError> {
    check_webview_key(&key)?;
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
    fn a_provider_credential_key_is_accepted() {
        assert!(super::check_webview_key("provider_credential.3f2a-9c1b").is_ok());
    }

    #[test]
    fn a_key_outside_the_grammar_is_rejected() {
        for key in [
            "",
            "github.pat",
            "goodboy.credential.abc",
            "goodboy.workspace.w1.linear",
            "provider_credential.",
            "provider_credential.a.b",
            "provider_credential.a/b",
            "provider_credential.a b",
            "Provider_credential.abc",
        ] {
            assert!(super::check_webview_key(key).is_err(), "{key}");
        }
        let long = format!("provider_credential.{}", "a".repeat(65));
        assert!(super::check_webview_key(&long).is_err());
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
        assert_eq!(directive("img-src"), "img-src 'self' data: blob:");
    }
}
