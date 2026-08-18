use std::collections::HashMap;
use std::sync::Mutex;

use rusqlite::Connection;
use thiserror::Error;

use crate::db;
use crate::secrets;

pub type SecretCache = Mutex<HashMap<String, String>>;

#[derive(Debug, Error)]
pub enum IntegrationCredentialError {
    #[error("unknown integration provider: {0}")]
    UnknownProvider(String),
    #[error("a workspace id is required to find a credential")]
    MissingWorkspace,
    #[error("a credential id is required")]
    MissingCredential,
    #[error("no {0} credential is stored under that id")]
    NoCredential(String),
    #[error("credential store error: {0}")]
    Store(String),
    #[error("secret store error: {0}")]
    Secret(#[from] secrets::SecretError),
}

crate::util::impl_error_serialize!(IntegrationCredentialError);

impl IntegrationCredentialError {
    fn kind(&self) -> &'static str {
        match self {
            IntegrationCredentialError::UnknownProvider(_) => "unknown_provider",
            IntegrationCredentialError::MissingWorkspace => "missing_workspace",
            IntegrationCredentialError::MissingCredential => "missing_credential",
            IntegrationCredentialError::NoCredential(_) => "no_credential",
            IntegrationCredentialError::Store(_) => "store",
            IntegrationCredentialError::Secret(_) => "secret",
        }
    }
}

pub const PROVIDERS: [&str; 6] = ["linear", "sentry", "gitlab", "jira", "bitbucket", "slack"];

pub(crate) fn secret_key(credential_id: &str) -> String {
    format!("goodboy.credential.{}", credential_id)
}

/// The pre-m114 slot, where a credential was pinned to the workspace that
/// pasted it. Nothing writes here any more; `adopt_with` empties it.
fn legacy_key(provider: &str, workspace_id: &str) -> Option<String> {
    PROVIDERS
        .contains(&provider)
        .then(|| format!("goodboy.workspace.{}.{}", workspace_id, provider))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LegacyBinding {
    pub credential_id: String,
    pub provider: String,
    pub workspace_id: String,
}

fn open_db() -> Result<Connection, IntegrationCredentialError> {
    let path =
        db::resolve_db_path().map_err(|e| IntegrationCredentialError::Store(e.to_string()))?;
    Connection::open(&path).map_err(|e| IntegrationCredentialError::Store(e.to_string()))
}

fn credential_id_in_db(
    provider: &str,
    workspace_id: &str,
) -> Result<Option<String>, IntegrationCredentialError> {
    let conn = open_db()?;
    let mut stmt = conn
        .prepare("SELECT credential_id FROM workspace_integrations WHERE workspace_id = ?1 AND provider = ?2 LIMIT 1")
        .map_err(|e| IntegrationCredentialError::Store(e.to_string()))?;
    let mut rows = stmt
        .query([workspace_id, provider])
        .map_err(|e| IntegrationCredentialError::Store(e.to_string()))?;
    let row = rows
        .next()
        .map_err(|e| IntegrationCredentialError::Store(e.to_string()))?;
    match row {
        Some(row) => row
            .get::<_, String>(0)
            .map(Some)
            .map_err(|e| IntegrationCredentialError::Store(e.to_string())),
        None => Ok(None),
    }
}

/// The per-workspace half of a connection: everything that is not the secret.
/// A shared credential must never carry it, or one project would overwrite
/// another project's scope.
pub(crate) fn config_for_workspace(
    provider: &str,
    workspace_id: &str,
) -> Result<Option<String>, IntegrationCredentialError> {
    let conn = open_db()?;
    let mut stmt = conn
        .prepare("SELECT config FROM workspace_integrations WHERE workspace_id = ?1 AND provider = ?2 LIMIT 1")
        .map_err(|e| IntegrationCredentialError::Store(e.to_string()))?;
    let mut rows = stmt
        .query([workspace_id, provider])
        .map_err(|e| IntegrationCredentialError::Store(e.to_string()))?;
    let row = rows
        .next()
        .map_err(|e| IntegrationCredentialError::Store(e.to_string()))?;
    match row {
        Some(row) => row
            .get::<_, String>(0)
            .map(Some)
            .map_err(|e| IntegrationCredentialError::Store(e.to_string())),
        None => Ok(None),
    }
}

fn legacy_bindings_in_db() -> Result<Vec<LegacyBinding>, IntegrationCredentialError> {
    let conn = open_db()?;
    let mut stmt = conn
        .prepare("SELECT credential_id, provider, workspace_id FROM workspace_integrations")
        .map_err(|e| IntegrationCredentialError::Store(e.to_string()))?;
    let rows = stmt
        .query_map([], |row| {
            Ok(LegacyBinding {
                credential_id: row.get(0)?,
                provider: row.get(1)?,
                workspace_id: row.get(2)?,
            })
        })
        .map_err(|e| IntegrationCredentialError::Store(e.to_string()))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| IntegrationCredentialError::Store(e.to_string()))
}

fn cached(cache: &SecretCache, credential_id: &str) -> Option<String> {
    cache.lock().ok()?.get(credential_id).cloned()
}

fn remember(cache: &SecretCache, credential_id: &str, secret: &str) {
    if let Ok(mut entries) = cache.lock() {
        entries.insert(credential_id.to_string(), secret.to_string());
    }
}

fn read_for_credential(
    provider: &str,
    credential_id: &str,
    cache: &SecretCache,
) -> Result<String, IntegrationCredentialError> {
    if let Some(hit) = cached(cache, credential_id) {
        return Ok(hit);
    }
    let secret = secrets::read(&secret_key(credential_id))?
        .ok_or_else(|| IntegrationCredentialError::NoCredential(provider.to_string()))?;
    remember(cache, credential_id, &secret);
    Ok(secret)
}

/// The secret a workspace's connection resolves to. The workspace names a
/// provider, the row names the credential, and only the credential's own id
/// ever reaches the keychain.
pub(crate) fn read_for_workspace(
    provider: &str,
    workspace_id: &str,
    cache: &SecretCache,
) -> Result<Option<String>, IntegrationCredentialError> {
    if !PROVIDERS.contains(&provider) {
        return Err(IntegrationCredentialError::UnknownProvider(
            provider.to_string(),
        ));
    }
    if workspace_id.is_empty() {
        return Err(IntegrationCredentialError::MissingWorkspace);
    }
    let Some(credential_id) = credential_id_in_db(provider, workspace_id)? else {
        return Ok(None);
    };
    read_for_credential(provider, &credential_id, cache).map(Some)
}

/// The token a connect attempt should verify: the one just typed, or the one
/// the chosen credential already holds. A reused credential never sends its
/// secret across the IPC boundary to get here.
pub(crate) fn secret_to_verify(
    provider: &str,
    credential_id: &str,
    supplied: Option<String>,
    cache: &SecretCache,
) -> Result<String, IntegrationCredentialError> {
    if credential_id.is_empty() {
        return Err(IntegrationCredentialError::MissingCredential);
    }
    match supplied.map(|value| value.trim().to_string()) {
        Some(value) if !value.is_empty() => Ok(value),
        _ => read_for_credential(provider, credential_id, cache),
    }
}

pub(crate) fn store_secret(
    credential_id: &str,
    secret: &str,
    cache: &SecretCache,
) -> Result<(), IntegrationCredentialError> {
    if credential_id.is_empty() {
        return Err(IntegrationCredentialError::MissingCredential);
    }
    secrets::set(&secret_key(credential_id), secret)?;
    remember(cache, credential_id, secret);
    Ok(())
}

fn adopt_with<R, W, C>(
    bindings: &[LegacyBinding],
    mut read: R,
    mut write: W,
    mut clear: C,
) -> Result<usize, IntegrationCredentialError>
where
    R: FnMut(&str) -> Result<Option<String>, secrets::SecretError>,
    W: FnMut(&str, &str) -> Result<(), secrets::SecretError>,
    C: FnMut(&str) -> Result<(), secrets::SecretError>,
{
    let mut adopted = 0;
    for binding in bindings {
        let target = secret_key(&binding.credential_id);
        if read(&target)?.is_some() {
            continue;
        }
        let Some(legacy) = legacy_key(&binding.provider, &binding.workspace_id) else {
            continue;
        };
        let Some(secret) = read(&legacy)? else {
            continue;
        };
        write(&target, &secret)?;
        clear(&legacy)?;
        adopted += 1;
    }
    Ok(adopted)
}

/// Moves every pre-m114 keychain entry onto the credential id its row now
/// carries. Safe to run on every boot: a credential already in place is left
/// alone, so no working connection is disturbed and none is lost.
#[tauri::command(async)]
pub fn integration_credentials_adopt() -> Result<usize, IntegrationCredentialError> {
    let bindings = legacy_bindings_in_db()?;
    adopt_with(&bindings, secrets::read, secrets::set, secrets::clear)
}

/// Removes the secret itself. The row is deleted first on the database side,
/// where a foreign key refuses while any workspace still references it.
#[tauri::command]
pub fn integration_credential_forget(
    credential_id: String,
) -> Result<(), IntegrationCredentialError> {
    if credential_id.is_empty() {
        return Err(IntegrationCredentialError::MissingCredential);
    }
    secrets::clear(&secret_key(&credential_id))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    fn cache() -> SecretCache {
        Mutex::new(HashMap::new())
    }

    #[test]
    fn a_credential_lives_under_its_own_id_and_never_under_a_workspace() {
        let key = secret_key("cred-7");

        assert_eq!(key, "goodboy.credential.cred-7");
        assert!(!key.contains("workspace"));
    }

    #[test]
    fn the_legacy_key_is_the_workspace_scoped_slot_of_every_known_provider() {
        for provider in PROVIDERS {
            assert_eq!(
                legacy_key(provider, "ws-1"),
                Some(format!("goodboy.workspace.ws-1.{}", provider))
            );
        }
        assert_eq!(legacy_key("asana", "ws-1"), None);
        assert_eq!(legacy_key("github", "ws-1"), None);
    }

    #[test]
    fn a_typed_token_is_what_gets_verified() {
        let secret = secret_to_verify("linear", "cred-1", Some("  lin_api_new  ".into()), &cache())
            .expect("token");

        assert_eq!(secret, "lin_api_new");
    }

    #[test]
    fn reusing_a_credential_verifies_what_the_cache_already_holds() {
        let cache = cache();
        remember(&cache, "cred-1", "lin_api_stored");

        let secret = secret_to_verify("linear", "cred-1", None, &cache).expect("token");

        assert_eq!(secret, "lin_api_stored");
    }

    #[test]
    fn an_empty_token_falls_back_to_the_stored_credential_rather_than_saving_it() {
        let cache = cache();
        remember(&cache, "cred-1", "lin_api_stored");

        let secret =
            secret_to_verify("linear", "cred-1", Some("   ".into()), &cache).expect("token");

        assert_eq!(secret, "lin_api_stored");
    }

    #[test]
    fn a_missing_credential_id_is_refused_before_any_key_is_built() {
        assert!(matches!(
            secret_to_verify("linear", "", Some("lin_api_new".into()), &cache()),
            Err(IntegrationCredentialError::MissingCredential)
        ));
        assert!(matches!(
            store_secret("", "lin_api_new", &cache()),
            Err(IntegrationCredentialError::MissingCredential)
        ));
    }

    #[test]
    fn adoption_moves_a_workspace_scoped_secret_onto_its_credential_id() {
        let written = RefCell::new(Vec::new());
        let cleared = RefCell::new(Vec::new());
        let bindings = vec![LegacyBinding {
            credential_id: "cred-1".into(),
            provider: "linear".into(),
            workspace_id: "ws-1".into(),
        }];

        let adopted = adopt_with(
            &bindings,
            |key| Ok((key == "goodboy.workspace.ws-1.linear").then(|| "lin_api_x".to_string())),
            |key, value| {
                written
                    .borrow_mut()
                    .push((key.to_string(), value.to_string()));
                Ok(())
            },
            |key| {
                cleared.borrow_mut().push(key.to_string());
                Ok(())
            },
        )
        .expect("adopt");

        assert_eq!(adopted, 1);
        assert_eq!(
            written.into_inner(),
            vec![(
                "goodboy.credential.cred-1".to_string(),
                "lin_api_x".to_string()
            )]
        );
        assert_eq!(cleared.into_inner(), vec!["goodboy.workspace.ws-1.linear"]);
    }

    #[test]
    fn adoption_leaves_a_credential_that_is_already_in_place_untouched() {
        let bindings = vec![LegacyBinding {
            credential_id: "cred-1".into(),
            provider: "linear".into(),
            workspace_id: "ws-1".into(),
        }];

        let adopted = adopt_with(
            &bindings,
            |key| Ok((key == "goodboy.credential.cred-1").then(|| "lin_api_x".to_string())),
            |_key, _value| panic!("an adopted credential must not be written again"),
            |_key| panic!("an adopted credential must not clear anything"),
        )
        .expect("adopt");

        assert_eq!(adopted, 0);
    }

    #[test]
    fn adoption_run_twice_writes_nothing_the_second_time() {
        let store = RefCell::new(HashMap::from([(
            "goodboy.workspace.ws-1.linear".to_string(),
            "lin_api_x".to_string(),
        )]));
        let bindings = vec![LegacyBinding {
            credential_id: "cred-1".into(),
            provider: "linear".into(),
            workspace_id: "ws-1".into(),
        }];

        let run = || {
            adopt_with(
                &bindings,
                |key| Ok(store.borrow().get(key).cloned()),
                |key, value| {
                    store
                        .borrow_mut()
                        .insert(key.to_string(), value.to_string());
                    Ok(())
                },
                |key| {
                    store.borrow_mut().remove(key);
                    Ok(())
                },
            )
        };

        assert_eq!(run().expect("first"), 1);
        assert_eq!(run().expect("second"), 0);
        assert_eq!(
            store.into_inner(),
            HashMap::from([(
                "goodboy.credential.cred-1".to_string(),
                "lin_api_x".to_string()
            )])
        );
    }

    #[test]
    fn adoption_carries_every_provider_across_in_one_pass() {
        let store = RefCell::new(
            PROVIDERS
                .iter()
                .map(|provider| {
                    (
                        format!("goodboy.workspace.ws-1.{}", provider),
                        format!("{}-secret", provider),
                    )
                })
                .collect::<HashMap<_, _>>(),
        );
        let bindings: Vec<LegacyBinding> = PROVIDERS
            .iter()
            .map(|provider| LegacyBinding {
                credential_id: format!("cred-{}", provider),
                provider: provider.to_string(),
                workspace_id: "ws-1".into(),
            })
            .collect();

        let adopted = adopt_with(
            &bindings,
            |key| Ok(store.borrow().get(key).cloned()),
            |key, value| {
                store
                    .borrow_mut()
                    .insert(key.to_string(), value.to_string());
                Ok(())
            },
            |key| {
                store.borrow_mut().remove(key);
                Ok(())
            },
        )
        .expect("adopt");

        assert_eq!(adopted, PROVIDERS.len());
        let remaining = store.into_inner();
        assert!(remaining
            .keys()
            .all(|key| key.starts_with("goodboy.credential.")));
        assert_eq!(
            remaining.get("goodboy.credential.cred-slack"),
            Some(&"slack-secret".to_string())
        );
    }

    #[test]
    fn a_workspace_with_nothing_stored_still_leaves_the_legacy_slot_alone() {
        let bindings = vec![LegacyBinding {
            credential_id: "cred-1".into(),
            provider: "linear".into(),
            workspace_id: "ws-1".into(),
        }];

        let adopted = adopt_with(
            &bindings,
            |_key| Ok(None),
            |_key, _value| panic!("nothing to write without a legacy secret"),
            |_key| panic!("nothing to clear without a legacy secret"),
        )
        .expect("adopt");

        assert_eq!(adopted, 0);
    }
}
