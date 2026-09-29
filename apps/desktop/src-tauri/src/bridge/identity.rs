use std::path::{Path, PathBuf};

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
    #[serde(skip)]
    store: PathBuf,
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
        Self::load_or_create_at(&identity_path()?)
    }

    pub(super) fn load_or_create_at(path: &Path) -> Result<Self, BridgeError> {
        if let Ok(bytes) = std::fs::read(path) {
            if let Ok(mut id) = serde_json::from_slice::<Identity>(&bytes) {
                id.store = path.to_path_buf();
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
            store: path.to_path_buf(),
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
        let path = &self.store;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(BridgeError::Io)?;
        }
        let json = serde_json::to_vec_pretty(self).map_err(BridgeError::Json)?;
        std::fs::write(path, json).map_err(BridgeError::Io)?;
        // The file holds the desktop's long-term Noise static private key; keep it
        // owner-only so other local accounts can't read it and impersonate us.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
                .map_err(BridgeError::Io)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Scratch(PathBuf);

    impl Scratch {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir().join(format!(
                "goodboy-bridge-identity-{name}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            std::fs::create_dir_all(&dir).unwrap();
            Self(dir)
        }

        fn file(&self) -> PathBuf {
            self.0.join("nested").join(IDENTITY_FILE)
        }
    }

    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    const PHONE_A: [u8; 32] = [0xa1; 32];
    const PHONE_B: [u8; 32] = [0xb2; 32];

    #[test]
    fn first_use_generates_and_persists_a_static_keypair() {
        let scratch = Scratch::new("first-use");

        let id = Identity::load_or_create_at(&scratch.file()).unwrap();

        assert_eq!(id.static_priv().unwrap().len(), 32);
        assert_eq!(b64().decode(&id.static_pub_b64).unwrap().len(), 32);
        assert_ne!(id.static_priv_b64, id.static_pub_b64);
        assert!(id.allow_list.is_empty());
        assert!(scratch.file().is_file());
    }

    #[test]
    fn a_second_load_returns_the_same_identity_and_enrolled_phones() {
        let scratch = Scratch::new("reload");
        let mut first = Identity::load_or_create_at(&scratch.file()).unwrap();
        first.enroll(&PHONE_A).unwrap();

        let second = Identity::load_or_create_at(&scratch.file()).unwrap();

        assert_eq!(second.static_priv_b64, first.static_priv_b64);
        assert_eq!(second.static_pub_b64, first.static_pub_b64);
        assert!(second.is_enrolled(&PHONE_A));
        assert!(!second.is_enrolled(&PHONE_B));
    }

    #[test]
    fn two_fresh_identities_never_share_a_key() {
        let one = Identity::load_or_create_at(&Scratch::new("key-one").file()).unwrap();
        let other = Identity::load_or_create_at(&Scratch::new("key-other").file()).unwrap();

        assert_ne!(one.static_priv_b64, other.static_priv_b64);
        assert_ne!(one.static_pub_b64, other.static_pub_b64);
    }

    #[test]
    fn a_phone_is_enrolled_only_after_it_was_enrolled() {
        let scratch = Scratch::new("enroll");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();
        assert!(!id.is_enrolled(&PHONE_A));

        id.enroll(&PHONE_A).unwrap();

        assert!(id.is_enrolled(&PHONE_A));
        assert!(!id.is_enrolled(&PHONE_B));
        assert!(!id.is_enrolled(&PHONE_A[..31]));
    }

    #[test]
    fn enrolling_the_same_phone_twice_keeps_one_entry() {
        let scratch = Scratch::new("enroll-twice");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();

        id.enroll(&PHONE_A).unwrap();
        id.enroll(&PHONE_A).unwrap();
        id.enroll(&PHONE_B).unwrap();

        assert_eq!(id.allow_list.len(), 2);
    }

    #[test]
    fn revoke_all_forgets_every_phone_and_the_disk_agrees() {
        let scratch = Scratch::new("revoke");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();
        id.enroll(&PHONE_A).unwrap();
        id.enroll(&PHONE_B).unwrap();

        id.revoke_all().unwrap();

        assert!(!id.is_enrolled(&PHONE_A));
        assert!(!id.is_enrolled(&PHONE_B));
        let reloaded = Identity::load_or_create_at(&scratch.file()).unwrap();
        assert!(!reloaded.is_enrolled(&PHONE_A));
        assert!(!reloaded.is_enrolled(&PHONE_B));
        assert_eq!(reloaded.static_priv_b64, id.static_priv_b64);
    }

    #[test]
    fn a_revoked_phone_can_be_enrolled_again_by_a_fresh_pairing() {
        let scratch = Scratch::new("re-enroll");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();
        id.enroll(&PHONE_A).unwrap();
        id.revoke_all().unwrap();

        id.enroll(&PHONE_A).unwrap();

        assert!(id.is_enrolled(&PHONE_A));
    }

    #[test]
    fn the_file_on_disk_holds_exactly_the_keys_and_the_allow_list() {
        let scratch = Scratch::new("file-shape");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();
        id.enroll(&PHONE_A).unwrap();

        let raw: serde_json::Value =
            serde_json::from_slice(&std::fs::read(scratch.file()).unwrap()).unwrap();

        let mut keys: Vec<&str> = raw
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        keys.sort_unstable();
        assert_eq!(keys, ["allow_list", "static_priv_b64", "static_pub_b64"]);
        assert_eq!(raw["allow_list"][0], b64().encode(PHONE_A));
    }

    #[cfg(unix)]
    #[test]
    fn the_private_key_file_is_owner_only() {
        use std::os::unix::fs::PermissionsExt;
        let scratch = Scratch::new("perms");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();
        let mode = |path: &Path| std::fs::metadata(path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode(&scratch.file()), 0o600);

        id.enroll(&PHONE_A).unwrap();
        id.revoke_all().unwrap();

        assert_eq!(mode(&scratch.file()), 0o600);
    }
}
