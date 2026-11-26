use std::path::{Path, PathBuf};

use base64::Engine as _;
use serde::{Deserialize, Serialize};

use super::noise_params;
use super::permissions::Permissions;
use super::BridgeError;

const IDENTITY_FILE: &str = "companion.json";
const DEFAULT_PHONE_NAME: &str = "iPhone";
const NAME_MAX_CHARS: usize = 48;
const SEEN_WRITE_EVERY_MS: i64 = 60_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairedPhone {
    pub key: String,
    pub name: String,
    pub paired_at: String,
    #[serde(default)]
    pub last_seen: Option<String>,
    #[serde(default)]
    pub permissions: Permissions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Identity {
    pub static_priv_b64: String,
    pub static_pub_b64: String,
    #[serde(default)]
    pub phones: Vec<PairedPhone>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interfaces: Option<Vec<String>>,
    #[serde(default, skip_serializing, rename = "allow_list")]
    legacy_allow_list: Vec<String>,
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

pub fn clean_phone_name(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .filter(|c| !c.is_control())
        .take(NAME_MAX_CHARS)
        .collect();
    let trimmed = cleaned.trim();
    match trimmed.is_empty() {
        true => DEFAULT_PHONE_NAME.to_string(),
        false => trimmed.to_string(),
    }
}

impl Identity {
    pub fn load_or_create() -> Result<Self, BridgeError> {
        Self::load_or_create_at(&identity_path()?)
    }

    pub(super) fn load_or_create_at(path: &Path) -> Result<Self, BridgeError> {
        if let Ok(bytes) = std::fs::read(path) {
            if let Ok(mut id) = serde_json::from_slice::<Identity>(&bytes) {
                id.store = path.to_path_buf();
                id.adopt_legacy_allow_list()?;
                return Ok(id);
            }
        }
        let keypair = snow::Builder::new(noise_params())
            .generate_keypair()
            .map_err(|e| BridgeError::Noise(e.to_string()))?;
        let id = Identity {
            static_priv_b64: b64().encode(keypair.private),
            static_pub_b64: b64().encode(keypair.public),
            phones: Vec::new(),
            interfaces: None,
            legacy_allow_list: Vec::new(),
            store: path.to_path_buf(),
        };
        id.persist()?;
        Ok(id)
    }

    fn adopt_legacy_allow_list(&mut self) -> Result<(), BridgeError> {
        if self.legacy_allow_list.is_empty() {
            return Ok(());
        }
        let now = crate::util::iso_now_whole_seconds();
        for key in std::mem::take(&mut self.legacy_allow_list) {
            if self.phones.iter().all(|p| p.key != key) {
                self.phones.push(PairedPhone {
                    key,
                    name: DEFAULT_PHONE_NAME.to_string(),
                    paired_at: now.clone(),
                    last_seen: None,
                    permissions: Permissions::default(),
                });
            }
        }
        self.persist()
    }

    pub fn static_priv(&self) -> Result<Vec<u8>, BridgeError> {
        b64()
            .decode(self.static_priv_b64.as_bytes())
            .map_err(|e| BridgeError::Decode(e.to_string()))
    }

    pub fn is_enrolled(&self, phone_static_pub: &[u8]) -> bool {
        let enc = b64().encode(phone_static_pub);
        self.phones.iter().any(|p| p.key == enc)
    }

    pub fn permissions_of(&self, phone_static_pub: &[u8]) -> Option<Permissions> {
        let enc = b64().encode(phone_static_pub);
        self.phones
            .iter()
            .find(|p| p.key == enc)
            .map(|p| p.permissions)
    }

    pub fn enroll(&mut self, phone_static_pub: &[u8], name: &str) -> Result<(), BridgeError> {
        let enc = b64().encode(phone_static_pub);
        let name = clean_phone_name(name);
        let now = crate::util::iso_now_whole_seconds();
        match self.phones.iter_mut().find(|p| p.key == enc) {
            Some(existing) => {
                existing.name = name;
                existing.last_seen = Some(now);
            }
            None => self.phones.push(PairedPhone {
                key: enc,
                name,
                paired_at: now.clone(),
                last_seen: Some(now),
                permissions: Permissions::default(),
            }),
        }
        self.persist()
    }

    pub fn touch_seen(&mut self, phone_static_pub: &[u8]) -> Result<(), BridgeError> {
        let enc = b64().encode(phone_static_pub);
        let now = crate::util::iso_now_whole_seconds();
        let Some(phone) = self.phones.iter_mut().find(|p| p.key == enc) else {
            return Ok(());
        };
        let is_fresh = phone
            .last_seen
            .as_deref()
            .and_then(crate::util::iso_to_ms)
            .zip(crate::util::iso_to_ms(&now))
            .is_some_and(|(seen, at)| at - seen < SEEN_WRITE_EVERY_MS);
        if is_fresh {
            return Ok(());
        }
        phone.last_seen = Some(now);
        self.persist()
    }

    pub fn set_permissions(
        &mut self,
        phone_id: &str,
        permissions: Permissions,
    ) -> Result<bool, BridgeError> {
        let mut next = self.clone();
        let Some(phone) = next.phones.iter_mut().find(|p| p.key == phone_id) else {
            return Ok(false);
        };
        phone.permissions = permissions;
        self.commit(next)?;
        Ok(true)
    }

    pub fn set_interfaces(&mut self, interfaces: Option<Vec<String>>) -> Result<(), BridgeError> {
        let mut next = self.clone();
        next.interfaces = interfaces;
        self.commit(next)
    }

    pub fn revoke_one(&mut self, phone_id: &str) -> Result<bool, BridgeError> {
        let mut next = self.clone();
        next.phones.retain(|p| p.key != phone_id);
        if next.phones.len() == self.phones.len() {
            return Ok(false);
        }
        self.commit(next)?;
        Ok(true)
    }

    pub fn revoke_all(&mut self) -> Result<(), BridgeError> {
        if self.phones.is_empty() {
            return Ok(());
        }
        let mut next = self.clone();
        next.phones.clear();
        self.commit(next)
    }

    fn commit(&mut self, next: Identity) -> Result<(), BridgeError> {
        next.persist()?;
        *self = next;
        Ok(())
    }

    fn persist(&self) -> Result<(), BridgeError> {
        let path = &self.store;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(BridgeError::Io)?;
        }
        let json = serde_json::to_vec_pretty(self).map_err(BridgeError::Json)?;
        crate::util::write_atomic_private(path, &json).map_err(BridgeError::Io)
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
        assert!(id.phones.is_empty());
        assert!(scratch.file().is_file());
    }

    #[test]
    fn a_second_load_returns_the_same_identity_and_enrolled_phones() {
        let scratch = Scratch::new("reload");
        let mut first = Identity::load_or_create_at(&scratch.file()).unwrap();
        first.enroll(&PHONE_A, "Harborline iPhone").unwrap();

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

        id.enroll(&PHONE_A, "Harborline iPhone").unwrap();

        assert!(id.is_enrolled(&PHONE_A));
        assert!(!id.is_enrolled(&PHONE_B));
        assert!(!id.is_enrolled(&PHONE_A[..31]));
    }

    #[test]
    fn enrolling_the_same_phone_twice_keeps_one_entry() {
        let scratch = Scratch::new("enroll-twice");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();

        id.enroll(&PHONE_A, "Harborline iPhone").unwrap();
        id.enroll(&PHONE_A, "Harborline iPhone").unwrap();
        id.enroll(&PHONE_B, "Harborline iPhone").unwrap();

        assert_eq!(id.phones.len(), 2);
    }

    #[test]
    fn revoke_all_forgets_every_phone_and_the_disk_agrees() {
        let scratch = Scratch::new("revoke");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();
        id.enroll(&PHONE_A, "Harborline iPhone").unwrap();
        id.enroll(&PHONE_B, "Harborline iPhone").unwrap();

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
        id.enroll(&PHONE_A, "Harborline iPhone").unwrap();
        id.revoke_all().unwrap();

        id.enroll(&PHONE_A, "Harborline iPhone").unwrap();

        assert!(id.is_enrolled(&PHONE_A));
    }

    #[test]
    fn the_file_on_disk_holds_the_keys_and_one_record_per_phone() {
        let scratch = Scratch::new("file-shape");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();
        id.enroll(&PHONE_A, "Harborline iPhone").unwrap();

        let raw: serde_json::Value =
            serde_json::from_slice(&std::fs::read(scratch.file()).unwrap()).unwrap();

        let mut keys: Vec<&str> = raw
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        keys.sort_unstable();
        assert_eq!(keys, ["phones", "static_priv_b64", "static_pub_b64"]);
        assert_eq!(raw["phones"][0]["key"], b64().encode(PHONE_A));
        assert_eq!(raw["phones"][0]["name"], "Harborline iPhone");
        assert_eq!(raw["phones"][0]["permissions"]["canStart"], false);
    }

    #[test]
    fn a_new_phone_starts_with_the_default_permissions() {
        let scratch = Scratch::new("default-permissions");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();

        id.enroll(&PHONE_A, "Harborline iPhone").unwrap();

        assert_eq!(id.permissions_of(&PHONE_A), Some(Permissions::default()));
        assert_eq!(id.permissions_of(&PHONE_B), None);
    }

    #[test]
    fn permissions_set_for_one_phone_persist_and_leave_the_other_alone() {
        let scratch = Scratch::new("permissions");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();
        id.enroll(&PHONE_A, "Harborline iPhone").unwrap();
        id.enroll(&PHONE_B, "Northwind iPhone").unwrap();
        let wide = Permissions {
            can_decide: false,
            can_merge: false,
            can_start: true,
        };

        let did = id.set_permissions(&b64().encode(PHONE_A), wide).unwrap();

        assert!(did);
        let reloaded = Identity::load_or_create_at(&scratch.file()).unwrap();
        assert_eq!(reloaded.permissions_of(&PHONE_A), Some(wide));
        assert_eq!(
            reloaded.permissions_of(&PHONE_B),
            Some(Permissions::default())
        );
    }

    #[test]
    fn setting_permissions_for_an_unknown_phone_changes_nothing() {
        let scratch = Scratch::new("permissions-unknown");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();

        let did = id
            .set_permissions("nobody", Permissions::default())
            .unwrap();

        assert!(!did);
    }

    #[test]
    fn re_pairing_a_known_phone_keeps_its_permissions() {
        let scratch = Scratch::new("re-pair-permissions");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();
        id.enroll(&PHONE_A, "Harborline iPhone").unwrap();
        let wide = Permissions {
            can_decide: true,
            can_merge: false,
            can_start: true,
        };
        id.set_permissions(&b64().encode(PHONE_A), wide).unwrap();

        id.enroll(&PHONE_A, "Harborline iPhone 2").unwrap();

        assert_eq!(id.permissions_of(&PHONE_A), Some(wide));
        assert_eq!(id.phones[0].name, "Harborline iPhone 2");
    }

    #[test]
    fn revoking_one_phone_keeps_the_others_and_the_disk_agrees() {
        let scratch = Scratch::new("revoke-one");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();
        id.enroll(&PHONE_A, "Harborline iPhone").unwrap();
        id.enroll(&PHONE_B, "Northwind iPhone").unwrap();

        let did = id.revoke_one(&b64().encode(PHONE_A)).unwrap();

        assert!(did);
        assert!(!id.is_enrolled(&PHONE_A));
        assert!(id.is_enrolled(&PHONE_B));
        let reloaded = Identity::load_or_create_at(&scratch.file()).unwrap();
        assert!(!reloaded.is_enrolled(&PHONE_A));
        assert!(reloaded.is_enrolled(&PHONE_B));
        assert_eq!(reloaded.static_priv_b64, id.static_priv_b64);
    }

    #[test]
    fn revoking_a_phone_that_is_not_paired_reports_it_and_changes_nothing() {
        let scratch = Scratch::new("revoke-one-missing");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();
        id.enroll(&PHONE_A, "Harborline iPhone").unwrap();

        let did = id.revoke_one(&b64().encode(PHONE_B)).unwrap();

        assert!(!did);
        assert!(id.is_enrolled(&PHONE_A));
    }

    #[test]
    fn a_phone_revoked_alone_pairs_again_with_default_permissions() {
        let scratch = Scratch::new("revoke-one-repair");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();
        id.enroll(&PHONE_A, "Harborline iPhone").unwrap();
        id.set_permissions(
            &b64().encode(PHONE_A),
            Permissions {
                can_decide: false,
                can_merge: false,
                can_start: true,
            },
        )
        .unwrap();
        id.revoke_one(&b64().encode(PHONE_A)).unwrap();

        id.enroll(&PHONE_A, "Harborline iPhone").unwrap();

        assert_eq!(id.permissions_of(&PHONE_A), Some(Permissions::default()));
    }

    #[test]
    fn a_v1_allow_list_is_adopted_as_phones_with_default_permissions() {
        let scratch = Scratch::new("legacy");
        let file = scratch.file();
        let fresh = Identity::load_or_create_at(&file).unwrap();
        let legacy = serde_json::json!({
            "static_priv_b64": fresh.static_priv_b64,
            "static_pub_b64": fresh.static_pub_b64,
            "allow_list": [b64().encode(PHONE_A), b64().encode(PHONE_B)],
        });
        std::fs::write(&file, serde_json::to_vec(&legacy).unwrap()).unwrap();

        let id = Identity::load_or_create_at(&file).unwrap();

        assert!(id.is_enrolled(&PHONE_A));
        assert!(id.is_enrolled(&PHONE_B));
        assert_eq!(id.permissions_of(&PHONE_A), Some(Permissions::default()));
        let raw: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&file).unwrap()).unwrap();
        assert!(raw.get("allow_list").is_none());
        assert_eq!(raw["phones"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn a_phone_name_is_trimmed_stripped_of_control_characters_and_capped() {
        assert_eq!(
            clean_phone_name("  Harborline iPhone \n"),
            "Harborline iPhone"
        );
        assert_eq!(clean_phone_name(""), "iPhone");
        assert_eq!(clean_phone_name("\u{7}\u{0}"), "iPhone");
        assert_eq!(clean_phone_name(&"x".repeat(200)).chars().count(), 48);
    }

    #[test]
    fn the_chosen_interfaces_persist_and_an_unset_choice_stays_unset() {
        let scratch = Scratch::new("interfaces");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();
        assert_eq!(id.interfaces, None);

        id.set_interfaces(Some(vec!["en0".to_string()])).unwrap();

        let reloaded = Identity::load_or_create_at(&scratch.file()).unwrap();
        assert_eq!(reloaded.interfaces, Some(vec!["en0".to_string()]));
    }

    #[test]
    fn touching_a_phone_that_just_connected_does_not_rewrite_the_file() {
        let scratch = Scratch::new("touch");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();
        id.enroll(&PHONE_A, "Harborline iPhone").unwrap();
        let seen = id.phones[0].last_seen.clone();

        id.touch_seen(&PHONE_A).unwrap();

        assert_eq!(id.phones[0].last_seen, seen);
        assert!(seen.is_some());
    }

    #[cfg(unix)]
    #[test]
    fn the_private_key_file_is_owner_only() {
        use std::os::unix::fs::PermissionsExt;
        let scratch = Scratch::new("perms");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();
        let mode = |path: &Path| std::fs::metadata(path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode(&scratch.file()), 0o600);

        id.enroll(&PHONE_A, "Harborline iPhone").unwrap();
        id.revoke_all().unwrap();

        assert_eq!(mode(&scratch.file()), 0o600);
    }

    #[test]
    fn a_failed_save_leaves_the_live_identity_as_it_was() {
        let scratch = Scratch::new("failed-save");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();
        id.enroll(b"phone-key", "Harborline phone").unwrap();
        let key = b64().encode(b"phone-key");
        let blocker = scratch.0.join("blocker");
        std::fs::write(&blocker, b"file").unwrap();
        id.store = blocker.join(IDENTITY_FILE);

        assert!(id.set_permissions(&key, Permissions::default()).is_err());
        assert!(id.set_interfaces(Some(vec!["en0".to_string()])).is_err());
        assert!(id.revoke_one(&key).is_err());
        assert!(id.revoke_all().is_err());

        assert!(id.interfaces.is_none());
        assert_eq!(id.phones.len(), 1);
    }
}
