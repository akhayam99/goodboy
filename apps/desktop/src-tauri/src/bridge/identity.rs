use std::path::PathBuf;

use base64::Engine as _;
use serde::{Deserialize, Serialize};

use super::noise_params;
use super::BridgeError;

const IDENTITY_FILE: &str = "companion.json";

/// Persisted pairing identity: the desktop's long-term Noise static key plus the
/// allow-list of enrolled phone static public keys (TOFU). Lives next to the DB
/// under `~/.goodboy/` and never leaves the machine.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Identity {
    /// X25519 static private key, base64 (raw 32 bytes).
    pub static_priv_b64: String,
    /// X25519 static public key, base64 (raw 32 bytes) — the QR `staticPub`.
    pub static_pub_b64: String,
    /// Enrolled phone static public keys, base64. Re-dial authorizes by membership.
    #[serde(default)]
    pub allow_list: Vec<String>,
}

fn b64() -> base64::engine::GeneralPurpose {
    base64::engine::general_purpose::STANDARD
}

fn identity_path() -> Result<PathBuf, BridgeError> {
    let home = dirs::home_dir().ok_or(BridgeError::NoHomeDir)?;
    Ok(home.join(".goodboy").join(IDENTITY_FILE))
}

impl Identity {
    /// Loads the persisted identity, generating (and writing) a fresh static
    /// keypair on first use.
    pub fn load_or_create() -> Result<Self, BridgeError> {
        let path = identity_path()?;
        if let Ok(bytes) = std::fs::read(&path) {
            if let Ok(id) = serde_json::from_slice::<Identity>(&bytes) {
                return Ok(id);
            }
        }
        let keypair = snow::Builder::new(noise_params())
            .generate_keypair()
            .map_err(|e| BridgeError::Noise(e.to_string()))?;
        let id = Identity {
            static_priv_b64: b64().encode(keypair.private),
            static_pub_b64: b64().encode(keypair.public),
            allow_list: Vec::new(),
        };
        id.persist()?;
        Ok(id)
    }

    pub fn static_priv(&self) -> Result<Vec<u8>, BridgeError> {
        b64()
            .decode(self.static_priv_b64.as_bytes())
            .map_err(|e| BridgeError::Decode(e.to_string()))
    }

    pub fn is_enrolled(&self, phone_static_pub: &[u8]) -> bool {
        let enc = b64().encode(phone_static_pub);
        self.allow_list.iter().any(|k| k == &enc)
    }

    pub fn enroll(&mut self, phone_static_pub: &[u8]) -> Result<(), BridgeError> {
        let enc = b64().encode(phone_static_pub);
        if !self.allow_list.contains(&enc) {
            self.allow_list.push(enc);
            self.persist()?;
        }
        Ok(())
    }

    /// Forgets every enrolled phone (desktop-initiated disconnect). Afterwards a
    /// re-dial fails the `is_enrolled` check, so a phone must scan a fresh QR to
    /// reconnect — restoring pairing is a deliberate human act on the desktop,
    /// never something the phone can do on its own.
    pub fn revoke_all(&mut self) -> Result<(), BridgeError> {
        if self.allow_list.is_empty() {
            return Ok(());
        }
        self.allow_list.clear();
        self.persist()
    }

    fn persist(&self) -> Result<(), BridgeError> {
        let path = identity_path()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(BridgeError::Io)?;
        }
        let json = serde_json::to_vec_pretty(self).map_err(BridgeError::Json)?;
        std::fs::write(&path, json).map_err(BridgeError::Io)?;
        // The file holds the desktop's long-term Noise static private key; keep it
        // owner-only so other local accounts can't read it and impersonate us.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))
                .map_err(BridgeError::Io)?;
        }
        Ok(())
    }
}
