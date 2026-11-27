use std::path::{Path, PathBuf};
use std::time::Duration;

use base64::Engine as _;
use serde::{Deserialize, Serialize};

use super::noise_params;
use super::permissions::Permissions;
use super::vault::{KeyVault, KeychainVault};
use super::BridgeError;

const IDENTITY_FILE: &str = "companion.json";
const DEFAULT_PHONE_NAME: &str = "iPhone";
const DEFAULT_DEVICE_LABEL: &str = "Mac";
#[cfg(test)]
const LEGACY_ALLOW_LIST_READ_UNTIL: &str = "0.45.0";
const NAME_MAX_CHARS: usize = 48;
const SEEN_WRITE_EVERY_MS: i64 = 60_000;
const VAULT_READ_ATTEMPTS: u32 = 3;
const VAULT_RETRY_PAUSE: Duration = Duration::from_millis(150);
const RECOVER_EVERY: Duration = Duration::from_secs(20);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IdentityFault {
    FileUnreadable,
    KeychainUnavailable,
    KeyMismatch,
}

impl IdentityFault {
    pub fn wire(self) -> &'static str {
        match self {
            Self::FileUnreadable => "file_unreadable",
            Self::KeychainUnavailable => "keychain_unavailable",
            Self::KeyMismatch => "key_mismatch",
        }
    }

    pub fn message(self) -> &'static str {
        match self {
            Self::FileUnreadable => {
                "The pairing file could not be read. The old file was kept aside. Reset pairing to start again, then scan a new code on every iPhone."
            }
            Self::KeychainUnavailable => {
                "The Keychain item with this Mac's pairing key could not be read. Unlock your Mac and open this page again, or reset pairing."
            }
            Self::KeyMismatch => {
                "The pairing file and the Keychain item do not belong together. Reset pairing to start again, then scan a new code on every iPhone."
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairedPhone {
    pub key: String,
    pub name: String,
    pub paired_at: String,
    #[serde(default)]
    pub last_seen: Option<String>,
    #[serde(default)]
    pub permissions: Permissions,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub rules: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Identity {
    #[serde(default, skip_serializing)]
    pub static_priv_b64: String,
    #[serde(default)]
    pub static_pub_b64: String,
    #[serde(default)]
    pub phones: Vec<PairedPhone>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interfaces: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub listen_port: Option<u16>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_label: Option<String>,
    #[serde(default, skip_serializing, rename = "allow_list")]
    legacy_allow_list: Vec<String>,
    #[serde(skip)]
    last_recover: Option<std::time::Instant>,
    #[serde(skip)]
    fault: Option<IdentityFault>,
    #[serde(skip)]
    store: PathBuf,
}

impl std::fmt::Debug for Identity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Identity")
            .field("static_pub_b64", &self.static_pub_b64)
            .field("phones", &self.phones.len())
            .field("fault", &self.fault)
            .finish_non_exhaustive()
    }
}

fn b64() -> base64::engine::GeneralPurpose {
    base64::engine::general_purpose::STANDARD
}

fn identity_path() -> Result<PathBuf, BridgeError> {
    let home = dirs::home_dir().ok_or(BridgeError::NoHomeDir)?;
    Ok(home.join(".goodboy").join(IDENTITY_FILE))
}

fn is_format_char(c: char) -> bool {
    matches!(
        c,
        '\u{00AD}'
            | '\u{061C}'
            | '\u{180E}'
            | '\u{200B}'..='\u{200F}'
            | '\u{202A}'..='\u{202E}'
            | '\u{2060}'..='\u{206F}'
            | '\u{FEFF}'
    )
}

pub fn clean_phone_name(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .filter(|c| !c.is_control() && !is_format_char(*c))
        .take(NAME_MAX_CHARS)
        .collect();
    let trimmed = cleaned.trim();
    match trimmed.is_empty() {
        true => DEFAULT_PHONE_NAME.to_string(),
        false => trimmed.to_string(),
    }
}

fn vault_value_of(private: &str, public: &str) -> String {
    format!("{private}:{public}")
}

fn split_vault_value(value: &str) -> Option<(String, String)> {
    let (private, public) = value.split_once(':')?;
    let is_key = |text: &str| b64().decode(text).is_ok_and(|bytes| bytes.len() == 32);
    match is_key(private) && is_key(public) {
        true => Some((private.to_string(), public.to_string())),
        false => None,
    }
}

fn read_vault(vault: &dyn KeyVault) -> Result<Option<String>, ()> {
    for attempt in 0..VAULT_READ_ATTEMPTS {
        match vault.read() {
            Ok(value) => return Ok(value),
            Err(error) => {
                log::warn!("[bridge] keychain read failed: {error}");
                if attempt + 1 < VAULT_READ_ATTEMPTS {
                    std::thread::sleep(VAULT_RETRY_PAUSE);
                }
            }
        }
    }
    Err(())
}

fn fresh_keypair() -> Result<(String, String), BridgeError> {
    let keypair = snow::Builder::new(noise_params())
        .generate_keypair()
        .map_err(|e| BridgeError::Noise(e.to_string()))?;
    Ok((b64().encode(keypair.private), b64().encode(keypair.public)))
}

fn set_aside(path: &Path) {
    let stamp = crate::util::now_secs();
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| IDENTITY_FILE.to_string());
    let target = path.with_file_name(format!("{name}.unreadable-{stamp}"));
    if let Err(error) = std::fs::rename(path, &target) {
        log::warn!("[bridge] could not set the unreadable pairing file aside: {error}");
    }
}

impl Identity {
    pub fn load_or_create() -> Self {
        match identity_path() {
            Ok(path) => Self::load_with(&path, &KeychainVault),
            Err(_) => Self::faulted(Path::new(IDENTITY_FILE), IdentityFault::FileUnreadable),
        }
    }

    pub fn load_with(path: &Path, vault: &dyn KeyVault) -> Self {
        match std::fs::read(path) {
            Ok(bytes) => match serde_json::from_slice::<Identity>(&bytes) {
                Ok(id) => id.settle(path, vault),
                Err(error) => {
                    log::warn!("[bridge] pairing file is not readable: {error}");
                    set_aside(path);
                    Self::faulted(path, IdentityFault::FileUnreadable)
                }
            },
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                Self::without_file(path, vault)
            }
            Err(error) => {
                log::warn!("[bridge] pairing file could not be opened: {error}");
                Self::faulted(path, IdentityFault::FileUnreadable)
            }
        }
    }

    fn faulted(path: &Path, fault: IdentityFault) -> Self {
        Self {
            static_priv_b64: String::new(),
            static_pub_b64: String::new(),
            phones: Vec::new(),
            interfaces: None,
            listen_port: None,
            device_label: None,
            legacy_allow_list: Vec::new(),
            last_recover: None,
            fault: Some(fault),
            store: path.to_path_buf(),
        }
    }

    fn without_file(path: &Path, vault: &dyn KeyVault) -> Self {
        let Ok(held) = read_vault(vault) else {
            return Self::faulted(path, IdentityFault::KeychainUnavailable);
        };
        let (private, public) = match held.as_deref() {
            Some(text) => match split_vault_value(text) {
                Some(pair) => pair,
                None => return Self::faulted(path, IdentityFault::KeyMismatch),
            },
            None => match Self::minted(vault) {
                Ok(minted) => minted,
                Err(_) => return Self::faulted(path, IdentityFault::KeychainUnavailable),
            },
        };
        let mut id = Self::faulted(path, IdentityFault::KeychainUnavailable);
        id.fault = None;
        id.static_priv_b64 = private;
        id.static_pub_b64 = public;
        match id.persist() {
            Ok(()) => id,
            Err(error) => {
                log::warn!("[bridge] pairing file could not be written: {error}");
                Self::faulted(path, IdentityFault::FileUnreadable)
            }
        }
    }

    fn minted(vault: &dyn KeyVault) -> Result<(String, String), BridgeError> {
        let (private, public) = fresh_keypair()?;
        vault
            .write(&vault_value_of(&private, &public))
            .map_err(|error| {
                log::warn!("[bridge] keychain write failed: {error}");
                BridgeError::IdentityUnavailable
            })?;
        Ok((private, public))
    }

    fn settle(mut self, path: &Path, vault: &dyn KeyVault) -> Self {
        self.store = path.to_path_buf();
        let is_adopted = self.adopt_legacy_allow_list();
        if self.static_priv_b64.is_empty() {
            return self.with_vault_key(vault, is_adopted);
        }
        if !self.migrate_key(vault) {
            return Self::faulted(path, IdentityFault::KeychainUnavailable);
        }
        match self.persist() {
            Ok(()) => self,
            Err(_) => Self::faulted(path, IdentityFault::FileUnreadable),
        }
    }

    fn with_vault_key(mut self, vault: &dyn KeyVault, is_dirty: bool) -> Self {
        let path = self.store.clone();
        let Ok(held) = read_vault(vault) else {
            return Self::faulted(&path, IdentityFault::KeychainUnavailable);
        };
        let Some(text) = held.as_deref() else {
            return Self::faulted(&path, IdentityFault::KeychainUnavailable);
        };
        let Some((private, public)) = split_vault_value(text) else {
            return Self::faulted(&path, IdentityFault::KeyMismatch);
        };
        if public != self.static_pub_b64 {
            return Self::faulted(&path, IdentityFault::KeyMismatch);
        }
        self.static_priv_b64 = private;
        match is_dirty && self.persist().is_err() {
            true => Self::faulted(&path, IdentityFault::FileUnreadable),
            false => self,
        }
    }

    fn migrate_key(&self, vault: &dyn KeyVault) -> bool {
        let value = vault_value_of(&self.static_priv_b64, &self.static_pub_b64);
        if let Err(error) = vault.write(&value) {
            log::warn!("[bridge] keychain write failed, the file is left as it is: {error}");
            return false;
        }
        matches!(vault.read(), Ok(Some(back)) if back == value)
    }

    pub fn try_recover(&mut self, vault: &dyn KeyVault) {
        if self.fault != Some(IdentityFault::KeychainUnavailable) {
            return;
        }
        if self
            .last_recover
            .is_some_and(|at| at.elapsed() < RECOVER_EVERY)
        {
            return;
        }
        let path = self.store.clone();
        let mut next = Self::load_with(&path, vault);
        if next.fault.is_some() {
            next.last_recover = Some(std::time::Instant::now());
        }
        *self = next;
    }

    pub fn reset_pairing(&mut self, vault: &dyn KeyVault) -> Result<(), BridgeError> {
        let (private, public) = fresh_keypair()?;
        vault
            .write(&vault_value_of(&private, &public))
            .map_err(|_| BridgeError::IdentityUnavailable)?;
        let mut next = Self::faulted(&self.store, IdentityFault::FileUnreadable);
        next.fault = None;
        next.static_priv_b64 = private;
        next.static_pub_b64 = public;
        next.interfaces = self.interfaces.clone();
        next.device_label = self.device_label.clone();
        next.persist()?;
        *self = next;
        Ok(())
    }

    pub fn fault(&self) -> Option<IdentityFault> {
        self.fault
    }

    pub fn device_label(&self) -> String {
        match self.device_label.as_deref().map(str::trim) {
            Some(label) if !label.is_empty() => label.to_string(),
            _ => DEFAULT_DEVICE_LABEL.to_string(),
        }
    }

    pub fn set_listen_port(&mut self, port: u16) -> Result<(), BridgeError> {
        if self.listen_port == Some(port) {
            return Ok(());
        }
        let mut next = self.clone();
        next.listen_port = Some(port);
        self.commit(next)
    }

    fn adopt_legacy_allow_list(&mut self) -> bool {
        if self.legacy_allow_list.is_empty() {
            return false;
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
                    rules: Vec::new(),
                });
            }
        }
        true
    }

    pub fn static_priv(&self) -> Result<Vec<u8>, BridgeError> {
        if self.fault.is_some() {
            return Err(BridgeError::IdentityUnavailable);
        }
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
                rules: Vec::new(),
            }),
        }
        self.persist()
    }

    pub fn note_rule(&mut self, phone_id: &str, rule_id: &str) -> Result<bool, BridgeError> {
        let mut next = self.clone();
        let Some(phone) = next.phones.iter_mut().find(|p| p.key == phone_id) else {
            return Ok(false);
        };
        if !phone.rules.iter().any(|r| r == rule_id) {
            phone.rules.push(rule_id.to_string());
        }
        self.commit(next)?;
        Ok(true)
    }

    pub fn rules_of(&self, phone_id: &str) -> Vec<String> {
        self.phones
            .iter()
            .find(|p| p.key == phone_id)
            .map(|p| p.rules.clone())
            .unwrap_or_default()
    }

    pub fn all_rules(&self) -> Vec<String> {
        self.phones.iter().flat_map(|p| p.rules.clone()).collect()
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
        if self.fault.is_some() {
            return Err(BridgeError::IdentityUnavailable);
        }
        let path = &self.store;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(BridgeError::Io)?;
        }
        let value = serde_json::to_value(self).map_err(BridgeError::Json)?;
        let json = serde_json::to_vec_pretty(&value).map_err(BridgeError::Json)?;
        crate::util::write_atomic_private(path, &json).map_err(BridgeError::Io)
    }
}

#[cfg(test)]
impl Identity {
    pub(super) fn load_or_create_at(path: &Path) -> Result<Self, BridgeError> {
        let vault = super::vault::MemoryVault::for_path(path);
        let id = Self::load_with(path, &*vault);
        match id.fault {
            Some(_) => Err(BridgeError::IdentityUnavailable),
            None => Ok(id),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::vault::{MemoryVault, VaultMode};
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
        assert_eq!(keys, ["phones", "static_pub_b64"]);
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
    fn the_legacy_allow_list_sunset_matches_the_versioning_doc() {
        let doc = include_str!("../../../../../docs/versioning.md");
        assert!(doc
            .lines()
            .any(|line| line.contains("companion.json")
                && line.contains(LEGACY_ALLOW_LIST_READ_UNTIL)));
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

    fn damaged(scratch: &Scratch) {
        let file = scratch.file();
        Identity::load_or_create_at(&file).unwrap();
        std::fs::write(&file, b"{ not json").unwrap();
    }

    fn aside_files(scratch: &Scratch) -> Vec<PathBuf> {
        std::fs::read_dir(scratch.file().parent().unwrap())
            .unwrap()
            .filter_map(Result::ok)
            .map(|e| e.path())
            .filter(|p| p.to_string_lossy().contains("unreadable"))
            .collect()
    }

    #[test]
    fn the_private_key_lives_in_the_keychain_and_never_in_the_file() {
        let scratch = Scratch::new("vault-only");
        let id = Identity::load_or_create_at(&scratch.file()).unwrap();

        let raw = std::fs::read_to_string(scratch.file()).unwrap();
        let held = MemoryVault::for_path(&scratch.file()).stored().unwrap();

        assert!(!raw.contains("static_priv_b64"));
        assert!(!raw.contains(&id.static_priv_b64));
        assert!(held.starts_with(&id.static_priv_b64));
    }

    #[test]
    fn a_key_found_in_the_file_moves_to_the_keychain_once_and_stays_the_same() {
        let scratch = Scratch::new("migrate");
        let file = scratch.file();
        let (private, public) = fresh_keypair().unwrap();
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        let old = serde_json::json!({
            "static_priv_b64": private,
            "static_pub_b64": public,
            "phones": [{ "key": b64().encode(PHONE_A), "name": "Harborline iPhone", "paired_at": "2026-01-01T00:00:00Z" }],
        });
        std::fs::write(&file, serde_json::to_vec(&old).unwrap()).unwrap();

        let id = Identity::load_or_create_at(&file).unwrap();

        assert_eq!(id.static_priv_b64, private);
        assert!(id.is_enrolled(&PHONE_A));
        let raw = std::fs::read_to_string(&file).unwrap();
        assert!(!raw.contains("static_priv_b64"));
        assert!(MemoryVault::for_path(&file)
            .stored()
            .unwrap()
            .starts_with(&private));
        let again = Identity::load_or_create_at(&file).unwrap();
        assert_eq!(again.static_priv_b64, private);
        assert_eq!(again.static_pub_b64, public);
    }

    #[test]
    fn a_key_that_cannot_reach_the_keychain_is_a_fault_and_the_file_is_untouched() {
        let scratch = Scratch::new("migrate-fails");
        let file = scratch.file();
        let (private, public) = fresh_keypair().unwrap();
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        let old = serde_json::json!({ "static_priv_b64": private, "static_pub_b64": public });
        std::fs::write(&file, serde_json::to_vec(&old).unwrap()).unwrap();
        let vault = MemoryVault::for_path(&file);
        vault.set_mode(VaultMode::WriteFails);

        let id = Identity::load_with(&file, &*vault);

        assert_eq!(id.fault(), Some(IdentityFault::KeychainUnavailable));
        assert!(id.static_priv().is_err());
        assert!(std::fs::read_to_string(&file).unwrap().contains(&private));
    }

    #[test]
    fn a_new_key_that_cannot_reach_the_keychain_is_never_written_to_a_file() {
        let scratch = Scratch::new("create-fails");
        let file = scratch.file();
        let vault = MemoryVault::for_path(&file);
        vault.set_mode(VaultMode::WriteFails);

        let id = Identity::load_with(&file, &*vault);

        assert_eq!(id.fault(), Some(IdentityFault::KeychainUnavailable));
        assert!(!file.exists());
    }

    #[test]
    fn debug_output_never_holds_the_private_key() {
        let scratch = Scratch::new("debug");
        let id = Identity::load_or_create_at(&scratch.file()).unwrap();

        assert!(!format!("{id:?}").contains(&id.static_priv_b64));
    }

    #[test]
    fn a_phone_name_loses_direction_overrides_and_zero_width_characters() {
        assert_eq!(clean_phone_name("Har\u{202E}bor\u{200B}line"), "Harborline");
    }

    #[test]
    fn a_rule_a_phone_made_is_listed_for_it_and_survives_a_reload() {
        let scratch = Scratch::new("rules");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();
        id.enroll(&PHONE_A, "Harborline iPhone").unwrap();
        id.enroll(&PHONE_B, "Northwind iPhone").unwrap();
        let a = b64().encode(PHONE_A);

        assert!(id.note_rule(&a, "rule-1").unwrap());
        assert!(id.note_rule(&a, "rule-1").unwrap());
        assert!(!id.note_rule("nobody", "rule-2").unwrap());

        let reloaded = Identity::load_or_create_at(&scratch.file()).unwrap();
        assert_eq!(reloaded.rules_of(&a), ["rule-1"]);
        assert!(reloaded.rules_of(&b64().encode(PHONE_B)).is_empty());
        assert_eq!(reloaded.all_rules(), ["rule-1"]);
    }

    #[test]
    fn a_locked_keychain_is_not_asked_again_inside_the_pause() {
        let scratch = Scratch::new("recover-pause");
        let file = scratch.file();
        Identity::load_or_create_at(&file).unwrap();
        let vault = MemoryVault::for_path(&file);
        vault.set_mode(VaultMode::ReadFails);
        let mut id = Identity::load_with(&file, &*vault);
        id.try_recover(&*vault);
        let reads = vault.reads();

        id.try_recover(&*vault);
        id.try_recover(&*vault);

        assert_eq!(vault.reads(), reads);
    }

    #[test]
    fn an_unreadable_file_never_mints_a_new_key() {
        let scratch = Scratch::new("unreadable");
        damaged(&scratch);
        let file = scratch.file();
        let vault = MemoryVault::for_path(&file);
        let before = vault.stored();

        let mut id = Identity::load_with(&file, &*vault);

        assert_eq!(id.fault(), Some(IdentityFault::FileUnreadable));
        assert!(id.static_priv().is_err());
        assert!(id.enroll(&PHONE_A, "Harborline iPhone").is_err());
        assert_eq!(vault.stored(), before);
        assert!(!file.exists());
        assert_eq!(aside_files(&scratch).len(), 1);
    }

    #[test]
    fn a_keychain_that_cannot_be_read_blocks_the_identity_and_recovers_later() {
        let scratch = Scratch::new("keychain-locked");
        let file = scratch.file();
        let first = Identity::load_or_create_at(&file).unwrap();
        let vault = MemoryVault::for_path(&file);
        vault.set_mode(VaultMode::ReadFails);
        let reads = vault.reads();

        let mut id = Identity::load_with(&file, &*vault);

        assert_eq!(id.fault(), Some(IdentityFault::KeychainUnavailable));
        assert_eq!(vault.reads() - reads, VAULT_READ_ATTEMPTS);
        assert!(file.exists());
        assert!(aside_files(&scratch).is_empty());
        vault.set_mode(VaultMode::Works);
        id.try_recover(&*vault);
        assert_eq!(id.fault(), None);
        assert_eq!(id.static_priv_b64, first.static_priv_b64);
    }

    #[test]
    fn a_missing_keychain_item_with_a_file_that_expects_one_is_an_error() {
        let scratch = Scratch::new("item-missing");
        let file = scratch.file();
        Identity::load_or_create_at(&file).unwrap();
        let fresh = MemoryVault::new();

        let id = Identity::load_with(&file, &*fresh);

        assert_eq!(id.fault(), Some(IdentityFault::KeychainUnavailable));
        assert_eq!(fresh.stored(), None);
    }

    #[test]
    fn a_keychain_key_for_another_file_is_a_mismatch() {
        let scratch = Scratch::new("mismatch");
        let file = scratch.file();
        Identity::load_or_create_at(&file).unwrap();
        let (private, public) = fresh_keypair().unwrap();
        let other = MemoryVault::new();
        other.put(&vault_value_of(&private, &public));

        let id = Identity::load_with(&file, &*other);

        assert_eq!(id.fault(), Some(IdentityFault::KeyMismatch));
    }

    #[test]
    fn a_missing_file_with_a_key_in_the_keychain_keeps_that_key() {
        let scratch = Scratch::new("file-gone");
        let file = scratch.file();
        let first = Identity::load_or_create_at(&file).unwrap();
        std::fs::remove_file(&file).unwrap();

        let again = Identity::load_or_create_at(&file).unwrap();

        assert_eq!(again.static_pub_b64, first.static_pub_b64);
        assert!(again.phones.is_empty());
    }

    #[test]
    fn resetting_pairing_makes_a_new_identity_and_keeps_the_old_file_aside() {
        let scratch = Scratch::new("reset");
        damaged(&scratch);
        let file = scratch.file();
        let vault = MemoryVault::for_path(&file);
        let mut id = Identity::load_with(&file, &*vault);

        id.reset_pairing(&*vault).unwrap();

        assert_eq!(id.fault(), None);
        assert_eq!(id.static_priv().unwrap().len(), 32);
        assert!(id.phones.is_empty());
        assert_eq!(aside_files(&scratch).len(), 1);
        let reloaded = Identity::load_with(&file, &*vault);
        assert_eq!(reloaded.fault(), None);
        assert_eq!(reloaded.static_pub_b64, id.static_pub_b64);
    }

    #[test]
    fn the_listen_port_persists_and_the_device_label_defaults_to_mac() {
        let scratch = Scratch::new("port");
        let mut id = Identity::load_or_create_at(&scratch.file()).unwrap();
        assert_eq!(id.listen_port, None);
        assert_eq!(id.device_label(), "Mac");

        id.set_listen_port(49152).unwrap();

        let reloaded = Identity::load_or_create_at(&scratch.file()).unwrap();
        assert_eq!(reloaded.listen_port, Some(49152));
    }
}
