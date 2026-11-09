use std::path::PathBuf;

use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager, Runtime, WebviewBuilder};

use super::lifecycle::{self, Gate};
use super::reason::{
    self, INVALID_WORKSPACE, PROFILE_BUSY, PROFILE_LIVE, PROFILE_SHARED, PROFILE_UNAVAILABLE,
};
use super::registry::{BrowserRegistry, ClearRefusal};
use crate::util::MessageError;

const PROFILE_SALT: &str = "goodboy-browser-profile:";
const PROFILES_DIR: [&str; 2] = ["browser", "profiles"];

#[cfg(target_os = "macos")]
const FIRST_MACOS_WITH_STORES: u32 = 14;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub(crate) struct ProfileId([u8; 16]);

impl ProfileId {
    pub(crate) fn of_workspace(workspace_id: &str) -> Result<Self, MessageError> {
        if workspace_id.trim().is_empty() {
            return Err(reason::refused(INVALID_WORKSPACE));
        }
        let digest = Sha256::new()
            .chain_update(PROFILE_SALT)
            .chain_update(workspace_id)
            .finalize();
        let mut bytes = [0u8; 16];
        bytes.copy_from_slice(&digest[..16]);
        Ok(Self(bytes))
    }

    #[cfg(any(target_os = "macos", test))]
    pub(crate) fn bytes(&self) -> [u8; 16] {
        self.0
    }

    #[cfg_attr(target_os = "macos", allow(dead_code))]
    pub(crate) fn name(&self) -> String {
        self.0.iter().map(|byte| format!("{byte:02x}")).collect()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum Isolation {
    PerWorkspace,
    Shared,
}

#[cfg(target_os = "macos")]
fn macos_major(version: &str) -> Option<u32> {
    version.trim().split('.').next()?.parse().ok()
}

#[cfg(target_os = "macos")]
fn macos_has_stores(version: &str) -> bool {
    macos_major(version).is_some_and(|major| major >= FIRST_MACOS_WITH_STORES)
}

#[cfg(target_os = "macos")]
pub(crate) fn isolation() -> Isolation {
    static CACHED: std::sync::OnceLock<Isolation> = std::sync::OnceLock::new();
    *CACHED.get_or_init(|| {
        let version = std::process::Command::new("/usr/bin/sw_vers")
            .arg("-productVersion")
            .output()
            .ok()
            .filter(|output| output.status.success())
            .map(|output| String::from_utf8_lossy(&output.stdout).into_owned());
        match version.as_deref().is_some_and(macos_has_stores) {
            true => Isolation::PerWorkspace,
            false => Isolation::Shared,
        }
    })
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn isolation() -> Isolation {
    Isolation::PerWorkspace
}

#[cfg_attr(target_os = "macos", allow(dead_code))]
pub(crate) struct BrowserProfiles {
    root: Option<PathBuf>,
}

impl BrowserProfiles {
    pub(crate) fn under(data_dir: PathBuf) -> Self {
        let root = PROFILES_DIR
            .iter()
            .fold(data_dir, |path, part| path.join(part));
        Self { root: Some(root) }
    }

    pub(crate) fn unavailable() -> Self {
        Self { root: None }
    }

    #[cfg_attr(target_os = "macos", allow(dead_code))]
    pub(crate) fn dir_of(&self, profile: &ProfileId) -> Result<PathBuf, MessageError> {
        self.root
            .as_ref()
            .map(|root| root.join(profile.name()))
            .ok_or_else(|| reason::failed(PROFILE_UNAVAILABLE))
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn scope<R: Runtime>(
    _app: &AppHandle<R>,
    builder: WebviewBuilder<R>,
    profile: &ProfileId,
) -> Result<WebviewBuilder<R>, MessageError> {
    match isolation() {
        Isolation::PerWorkspace => Ok(builder.data_store_identifier(profile.bytes())),
        Isolation::Shared => Ok(builder),
    }
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn scope<R: Runtime>(
    app: &AppHandle<R>,
    builder: WebviewBuilder<R>,
    profile: &ProfileId,
) -> Result<WebviewBuilder<R>, MessageError> {
    let dir = app.state::<BrowserProfiles>().dir_of(profile)?;
    std::fs::create_dir_all(&dir).map_err(|error| MessageError::Failed(error.to_string()))?;
    Ok(builder.data_directory(dir))
}

pub(crate) fn activate<R: Runtime>(
    app: &AppHandle<R>,
    profile: &ProfileId,
    gate: &Gate<'_>,
) -> Result<(), MessageError> {
    let registry = app.state::<BrowserRegistry>();
    if registry.is_clearing(profile) {
        return Err(reason::refused(PROFILE_BUSY));
    }
    let others = registry.open_outside(profile);
    lifecycle::close_for_switch(app, &others, gate)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ClearOutcome {
    pub(crate) should_restart: bool,
}

pub(crate) struct ClearLease<R: Runtime> {
    app: AppHandle<R>,
    profile: ProfileId,
}

impl<R: Runtime> Drop for ClearLease<R> {
    fn drop(&mut self) {
        self.app.state::<BrowserRegistry>().end_clear(&self.profile);
    }
}

pub(crate) fn begin_clear<R: Runtime>(
    app: &AppHandle<R>,
    workspace_id: &str,
) -> Result<ClearLease<R>, MessageError> {
    let profile = ProfileId::of_workspace(workspace_id)?;
    if isolation() == Isolation::Shared {
        return Err(reason::refused(PROFILE_SHARED));
    }
    let registry = app.state::<BrowserRegistry>();
    let _gate = registry.gate();
    registry
        .begin_clear(&profile)
        .map_err(|refusal| match refusal {
            ClearRefusal::Live => reason::refused(PROFILE_LIVE),
            ClearRefusal::Clearing => reason::refused(PROFILE_BUSY),
        })?;
    Ok(ClearLease {
        app: app.clone(),
        profile,
    })
}

#[cfg(target_os = "macos")]
pub(crate) async fn wipe<R: Runtime>(lease: &ClearLease<R>) -> Result<ClearOutcome, MessageError> {
    lease
        .app
        .remove_data_store(lease.profile.bytes())
        .await
        .map_err(|error| MessageError::Failed(error.to_string()))?;
    Ok(ClearOutcome {
        should_restart: false,
    })
}

#[cfg(not(target_os = "macos"))]
pub(crate) async fn wipe<R: Runtime>(lease: &ClearLease<R>) -> Result<ClearOutcome, MessageError> {
    let dir = lease
        .app
        .state::<BrowserProfiles>()
        .dir_of(&lease.profile)?;
    match std::fs::remove_dir_all(&dir) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(MessageError::Failed(error.to_string())),
    }
    Ok(ClearOutcome {
        should_restart: cfg!(target_os = "linux"),
    })
}

pub(crate) async fn clear<R: Runtime>(
    app: &AppHandle<R>,
    workspace_id: &str,
) -> Result<ClearOutcome, MessageError> {
    let lease = begin_clear(app, workspace_id)?;
    wipe(&lease).await
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::*;

    fn profile(workspace_id: &str) -> ProfileId {
        ProfileId::of_workspace(workspace_id).expect("workspace id is valid")
    }

    #[test]
    fn a_workspace_always_gets_the_same_profile() {
        assert_eq!(profile("northwind"), profile("northwind"));
        assert_eq!(profile("northwind").name(), profile("northwind").name());
        assert_eq!(profile("northwind").bytes(), profile("northwind").bytes());
    }

    #[test]
    fn two_workspaces_never_share_a_profile() {
        let ids: HashSet<ProfileId> = [
            "northwind",
            "acme",
            "harborline",
            "cascadia",
            "Acme",
            "acme ",
        ]
        .into_iter()
        .map(profile)
        .collect();
        assert_eq!(ids.len(), 6);
    }

    #[test]
    fn a_profile_name_is_a_path_safe_hex_string() {
        let name = profile("../../etc/passwd").name();
        assert_eq!(name.len(), 32);
        assert!(name.bytes().all(|byte| byte.is_ascii_hexdigit()));
    }

    #[test]
    fn a_blank_workspace_id_has_no_profile() {
        for blank in ["", "  ", "\t\n"] {
            assert!(
                matches!(
                    ProfileId::of_workspace(blank),
                    Err(MessageError::Refused(ref code)) if code == INVALID_WORKSPACE
                ),
                "{blank:?}"
            );
        }
    }

    #[test]
    fn a_profile_folder_is_stable_distinct_and_under_the_app_data_dir() {
        let profiles = BrowserProfiles::under(PathBuf::from("/data/goodboy"));
        let northwind = profiles.dir_of(&profile("northwind")).expect("dir");
        let acme = profiles.dir_of(&profile("acme")).expect("dir");
        assert_eq!(
            northwind,
            profiles.dir_of(&profile("northwind")).expect("dir")
        );
        assert_ne!(northwind, acme);
        assert_eq!(
            northwind.parent(),
            Some(PathBuf::from("/data/goodboy/browser/profiles").as_path())
        );
    }

    #[test]
    fn without_an_app_data_dir_a_profile_has_no_folder() {
        let profiles = BrowserProfiles::unavailable();
        assert!(matches!(
            profiles.dir_of(&profile("northwind")),
            Err(MessageError::Failed(ref code)) if code == PROFILE_UNAVAILABLE
        ));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_has_custom_stores_from_fourteen() {
        assert!(macos_has_stores("14.0"));
        assert!(macos_has_stores("26.1.2\n"));
        assert!(!macos_has_stores("13.6.9"));
        assert!(!macos_has_stores("12"));
        assert!(!macos_has_stores(""));
        assert!(!macos_has_stores("sonoma"));
    }

    #[test]
    fn isolation_is_serialized_for_the_pane() {
        assert_eq!(
            serde_json::to_value(Isolation::PerWorkspace).expect("serializes"),
            serde_json::json!("perWorkspace")
        );
        assert_eq!(
            serde_json::to_value(Isolation::Shared).expect("serializes"),
            serde_json::json!("shared")
        );
    }
}
