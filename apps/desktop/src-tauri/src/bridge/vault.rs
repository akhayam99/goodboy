use std::fmt;

pub const KEY_NAME: &str = "bridge.static_key";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VaultError(pub String);

impl fmt::Display for VaultError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

pub trait KeyVault: Send + Sync {
    fn read(&self) -> Result<Option<String>, VaultError>;
    fn write(&self, value: &str) -> Result<(), VaultError>;
}

pub struct KeychainVault;

impl KeyVault for KeychainVault {
    fn read(&self) -> Result<Option<String>, VaultError> {
        crate::secrets::read(KEY_NAME).map_err(|e| VaultError(e.to_string()))
    }

    fn write(&self, value: &str) -> Result<(), VaultError> {
        crate::secrets::set(KEY_NAME, value).map_err(|e| VaultError(e.to_string()))
    }
}

#[cfg(test)]
pub use memory::{MemoryVault, VaultMode};

#[cfg(test)]
mod memory {
    use super::*;
    use std::collections::HashMap;
    use std::path::{Path, PathBuf};
    use std::sync::{Arc, Mutex, OnceLock};

    #[derive(Clone, Copy, PartialEq, Eq)]
    pub enum VaultMode {
        Works,
        ReadFails,
        WriteFails,
    }

    pub struct MemoryVault {
        value: Mutex<Option<String>>,
        mode: Mutex<VaultMode>,
        reads: Mutex<u32>,
    }

    impl MemoryVault {
        pub fn new() -> Arc<Self> {
            Arc::new(Self {
                value: Mutex::new(None),
                mode: Mutex::new(VaultMode::Works),
                reads: Mutex::new(0),
            })
        }

        pub fn for_path(path: &Path) -> Arc<Self> {
            static REGISTRY: OnceLock<Mutex<HashMap<PathBuf, Arc<MemoryVault>>>> = OnceLock::new();
            let mut registry = REGISTRY.get_or_init(Default::default).lock().unwrap();
            registry
                .entry(path.to_path_buf())
                .or_insert_with(MemoryVault::new)
                .clone()
        }

        pub fn set_mode(&self, mode: VaultMode) {
            *self.mode.lock().unwrap() = mode;
        }

        pub fn stored(&self) -> Option<String> {
            self.value.lock().unwrap().clone()
        }

        pub fn reads(&self) -> u32 {
            *self.reads.lock().unwrap()
        }

        pub fn put(&self, value: &str) {
            *self.value.lock().unwrap() = Some(value.to_string());
        }
    }

    impl KeyVault for MemoryVault {
        fn read(&self) -> Result<Option<String>, VaultError> {
            *self.reads.lock().unwrap() += 1;
            match *self.mode.lock().unwrap() {
                VaultMode::ReadFails => Err(VaultError("keychain is locked".into())),
                _ => Ok(self.value.lock().unwrap().clone()),
            }
        }

        fn write(&self, value: &str) -> Result<(), VaultError> {
            match *self.mode.lock().unwrap() {
                VaultMode::WriteFails => Err(VaultError("keychain refused the write".into())),
                _ => {
                    *self.value.lock().unwrap() = Some(value.to_string());
                    Ok(())
                }
            }
        }
    }
}
