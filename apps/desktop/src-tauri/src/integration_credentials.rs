use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

use rusqlite::{Connection, OptionalExtension};
use thiserror::Error;

use crate::db;
use crate::secrets;
use crate::util::now_ms;

pub type SecretCache = Mutex<HashMap<String, String>>;

static SHARED_CACHE: LazyLock<SecretCache> = LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn shared_cache() -> &'static SecretCache {
    &SHARED_CACHE
}

macro_rules! token_cache {
    ($name:ident) => {
        pub struct $name(pub(crate) &'static $crate::integration_credentials::SecretCache);

        impl $name {
            pub fn new() -> Self {
                Self($crate::integration_credentials::shared_cache())
            }
        }

        impl Default for $name {
            fn default() -> Self {
                Self::new()
            }
        }
    };
}

pub(crate) use token_cache;

#[derive(Debug, Error)]
pub enum IntegrationCredentialError {
    #[error("unknown integration provider: {0}")]
    UnknownProvider(String),
    #[error("a workspace id is required to find a credential")]
    MissingWorkspace,
    #[error("a credential id is required")]
    MissingCredential,
    #[error("the {provider} key for this connection is missing from the keychain, paste it again to reconnect")]
    MissingSecret {
        provider: String,
        credential_id: String,
    },
    #[error("the {field} sent for {provider} is not the one this connection is bound to")]
    UnboundValue { provider: String, field: String },
    #[error("credential store error: {0}")]
    Store(String),
    #[error("secret store error: {0}")]
    Secret(#[from] secrets::SecretError),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

crate::util::impl_error_serialize!(IntegrationCredentialError);

impl IntegrationCredentialError {
    fn kind(&self) -> &'static str {
        match self {
            IntegrationCredentialError::UnknownProvider(_) => "unknown_provider",
            IntegrationCredentialError::MissingWorkspace => "missing_workspace",
            IntegrationCredentialError::MissingCredential => "missing_credential",
            IntegrationCredentialError::MissingSecret { .. } => "missing_secret",
            IntegrationCredentialError::UnboundValue { .. } => "unbound_value",
            IntegrationCredentialError::Store(_) => "store",
            IntegrationCredentialError::Secret(_) => "secret",
            IntegrationCredentialError::Io(_) => "io",
        }
    }
}

pub const PROVIDERS: [&str; 6] = ["linear", "sentry", "gitlab", "jira", "bitbucket", "slack"];

pub const BINDING_PROVIDERS: [&str; 7] = [
    "linear",
    "sentry",
    "gitlab",
    "jira",
    "bitbucket",
    "slack",
    "github",
];

const GITHUB_PROVIDER: &str = "github";
const GITHUB_LEGACY_KEY: &str = "github.pat";

pub(crate) fn secret_key(credential_id: &str) -> String {
    format!("goodboy.credential.{}", credential_id)
}

fn legacy_key(provider: &str, workspace_id: &str) -> Option<String> {
    PROVIDERS
        .contains(&provider)
        .then(|| format!("goodboy.workspace.{}.{}", workspace_id, provider))
}

fn github_legacy_key(workspace_id: &str) -> String {
    format!("{}.{}", GITHUB_LEGACY_KEY, workspace_id)
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
    db::open_connection(&path).map_err(|e| IntegrationCredentialError::Store(e.to_string()))
}

fn store_err(e: rusqlite::Error) -> IntegrationCredentialError {
    IntegrationCredentialError::Store(e.to_string())
}

fn new_id(conn: &Connection) -> Result<String, IntegrationCredentialError> {
    conn.query_row("SELECT lower(hex(randomblob(16)))", [], |row| row.get(0))
        .map_err(store_err)
}

fn credential_id_for_binding(
    conn: &Connection,
    provider: &str,
    workspace_id: &str,
    project_id: Option<&str>,
) -> Result<Option<String>, IntegrationCredentialError> {
    conn.query_row(
        "SELECT credential_id FROM integration_bindings
         WHERE workspace_id = ?1 AND provider = ?2
           AND (project_id IS NULL OR (?3 IS NOT NULL AND project_id = ?3))
         ORDER BY project_id IS NULL
         LIMIT 1",
        rusqlite::params![workspace_id, provider, project_id],
        |row| row.get(0),
    )
    .optional()
    .map_err(store_err)
}

fn global_credential_id(
    conn: &Connection,
    provider: &str,
) -> Result<Option<String>, IntegrationCredentialError> {
    Ok(global_credential_ids(conn, provider)?.into_iter().next())
}

fn global_credential_ids(
    conn: &Connection,
    provider: &str,
) -> Result<Vec<String>, IntegrationCredentialError> {
    let mut stmt = conn
        .prepare(
            "SELECT c.id FROM integration_credentials c
             WHERE c.provider = ?1
               AND NOT EXISTS (SELECT 1 FROM integration_bindings b WHERE b.credential_id = c.id)
             ORDER BY c.updated_at DESC, c.id ASC",
        )
        .map_err(store_err)?;
    let rows = stmt
        .query_map(rusqlite::params![provider], |row| row.get(0))
        .map_err(store_err)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(store_err)
}

fn config_for_binding_in(
    conn: &Connection,
    provider: &str,
    workspace_id: &str,
    project_id: Option<&str>,
) -> Result<Option<String>, IntegrationCredentialError> {
    conn.query_row(
        "SELECT config FROM integration_bindings
         WHERE workspace_id = ?1 AND provider = ?2
           AND (project_id IS NULL OR (?3 IS NOT NULL AND project_id = ?3))
         ORDER BY project_id IS NULL
         LIMIT 1",
        rusqlite::params![workspace_id, provider, project_id],
        |row| row.get(0),
    )
    .optional()
    .map_err(store_err)
}

pub(crate) fn config_for_binding(
    provider: &str,
    workspace_id: &str,
    project_id: Option<&str>,
) -> Result<Option<String>, IntegrationCredentialError> {
    let conn = open_db()?;
    config_for_binding_in(&conn, provider, workspace_id, project_id)
}

pub(crate) struct BoundValue<'a> {
    pub key: &'a str,
    pub supplied: &'a str,
}

fn normalize_bound(value: &str) -> String {
    value.trim().trim_end_matches('/').to_ascii_lowercase()
}

fn check_bound(
    provider: &str,
    config: Option<&str>,
    values: &[BoundValue],
) -> Result<(), IntegrationCredentialError> {
    let parsed: Option<serde_json::Value> = config.and_then(|raw| serde_json::from_str(raw).ok());
    for value in values {
        let bound = parsed
            .as_ref()
            .and_then(|config| config.get(value.key))
            .and_then(|held| held.as_str());
        let matches = bound
            .map(|held| normalize_bound(held) == normalize_bound(value.supplied))
            .unwrap_or(false);
        if !matches {
            return Err(IntegrationCredentialError::UnboundValue {
                provider: provider.to_string(),
                field: value.key.to_string(),
            });
        }
    }
    Ok(())
}

pub(crate) fn require_bound(
    provider: &str,
    workspace_id: &str,
    project_id: Option<&str>,
    values: &[BoundValue],
) -> Result<(), IntegrationCredentialError> {
    let config = config_for_binding(provider, workspace_id, project_id)?;
    check_bound(provider, config.as_deref(), values)
}

fn legacy_bindings_in_db() -> Result<Vec<LegacyBinding>, IntegrationCredentialError> {
    let conn = open_db()?;
    let mut stmt = conn
        .prepare(
            "SELECT b.credential_id, b.provider, p.id
             FROM integration_bindings b
             JOIN projects p ON p.workspace_id = b.workspace_id
               AND (b.project_id IS NULL OR b.project_id = p.id)
             WHERE b.provider <> 'github'",
        )
        .map_err(store_err)?;
    let rows = stmt
        .query_map([], |row| {
            Ok(LegacyBinding {
                credential_id: row.get(0)?,
                provider: row.get(1)?,
                workspace_id: row.get(2)?,
            })
        })
        .map_err(store_err)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(store_err)
}

fn cached(cache: &SecretCache, credential_id: &str) -> Option<String> {
    cache.lock().ok()?.get(credential_id).cloned()
}

fn evict(cache: &SecretCache, credential_id: &str) {
    if let Ok(mut entries) = cache.lock() {
        entries.remove(credential_id);
    }
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
    let secret = secrets::read(&secret_key(credential_id))?.ok_or_else(|| {
        IntegrationCredentialError::MissingSecret {
            provider: provider.to_string(),
            credential_id: credential_id.to_string(),
        }
    })?;
    remember(cache, credential_id, &secret);
    Ok(secret)
}

pub(crate) fn read_for_binding(
    provider: &str,
    workspace_id: &str,
    project_id: Option<&str>,
    cache: &SecretCache,
) -> Result<Option<String>, IntegrationCredentialError> {
    if !BINDING_PROVIDERS.contains(&provider) {
        return Err(IntegrationCredentialError::UnknownProvider(
            provider.to_string(),
        ));
    }
    if workspace_id.is_empty() {
        return Err(IntegrationCredentialError::MissingWorkspace);
    }
    let conn = open_db()?;
    resolve_and_read(
        &conn,
        provider,
        workspace_id,
        project_id,
        |credential_id| match cached(cache, credential_id) {
            Some(hit) => Ok(Some(hit)),
            None => {
                let found = secrets::read(&secret_key(credential_id))?;
                if let Some(secret) = found.as_deref() {
                    remember(cache, credential_id, secret);
                }
                Ok(found)
            }
        },
    )
}

fn resolve_and_read<F>(
    conn: &Connection,
    provider: &str,
    workspace_id: &str,
    project_id: Option<&str>,
    mut read_secret: F,
) -> Result<Option<String>, IntegrationCredentialError>
where
    F: FnMut(&str) -> Result<Option<String>, secrets::SecretError>,
{
    if let Some(credential_id) =
        credential_id_for_binding(conn, provider, workspace_id, project_id)?
    {
        return match read_secret(&credential_id)? {
            Some(secret) => Ok(Some(secret)),
            None => Err(IntegrationCredentialError::MissingSecret {
                provider: provider.to_string(),
                credential_id,
            }),
        };
    }
    for credential_id in global_credential_ids(conn, provider)? {
        if let Some(secret) = read_secret(&credential_id)? {
            return Ok(Some(secret));
        }
    }
    Ok(None)
}

pub(crate) fn read_global(
    provider: &str,
    cache: &SecretCache,
) -> Result<Option<String>, IntegrationCredentialError> {
    let conn = open_db()?;
    let Some(credential_id) = global_credential_id(&conn, provider)? else {
        return Ok(None);
    };
    read_for_credential(provider, &credential_id, cache).map(Some)
}

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

fn insert_github_credential(
    conn: &Connection,
    credential_id: &str,
) -> Result<(), IntegrationCredentialError> {
    let now = now_ms();
    conn.execute(
        "INSERT INTO integration_credentials (id, provider, label, account, created_at, updated_at)
         VALUES (?1, 'github', 'GitHub', '', ?2, ?2)",
        rusqlite::params![credential_id, now],
    )
    .map_err(store_err)?;
    Ok(())
}

fn insert_github_binding(
    conn: &Connection,
    workspace_id: &str,
    project_id: Option<&str>,
    credential_id: &str,
) -> Result<(), IntegrationCredentialError> {
    let now = now_ms();
    let id = new_id(conn)?;
    conn.execute(
        "INSERT INTO integration_bindings (id, workspace_id, project_id, provider, credential_id, config, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'github', ?4, '{}', ?5, ?5)",
        rusqlite::params![id, workspace_id, project_id, credential_id, now],
    )
    .map_err(store_err)?;
    Ok(())
}

fn github_binding_exists(
    conn: &Connection,
    workspace_id: &str,
    project_id: Option<&str>,
) -> Result<bool, IntegrationCredentialError> {
    conn.query_row(
        "SELECT 1 FROM integration_bindings
         WHERE workspace_id = ?1 AND provider = 'github'
           AND ((?2 IS NULL AND project_id IS NULL) OR project_id = ?2)
         LIMIT 1",
        rusqlite::params![workspace_id, project_id],
        |_| Ok(()),
    )
    .optional()
    .map_err(store_err)
    .map(|hit| hit.is_some())
}

pub(crate) fn github_store_token(
    workspace_id: Option<&str>,
    token: &str,
) -> Result<(), IntegrationCredentialError> {
    let conn = open_db()?;
    github_store_token_with(&conn, workspace_id, token, shared_cache(), secrets::set)
}

fn github_store_token_with<S>(
    conn: &Connection,
    workspace_id: Option<&str>,
    token: &str,
    cache: &SecretCache,
    set: S,
) -> Result<(), IntegrationCredentialError>
where
    S: FnOnce(&str, &str) -> Result<(), secrets::SecretError>,
{
    let credential_id = match workspace_id.filter(|id| !id.is_empty()) {
        Some(ws) => match credential_id_for_binding(conn, GITHUB_PROVIDER, ws, None)? {
            Some(id) => id,
            None => {
                let id = new_id(conn)?;
                insert_github_credential(conn, &id)?;
                insert_github_binding(conn, ws, None, &id)?;
                id
            }
        },
        None => match global_credential_id(conn, GITHUB_PROVIDER)? {
            Some(id) => id,
            None => {
                let id = new_id(conn)?;
                insert_github_credential(conn, &id)?;
                id
            }
        },
    };
    set(&secret_key(&credential_id), token)?;
    remember(cache, &credential_id, token);
    Ok(())
}

fn delete_credential_if_unbound<C>(
    conn: &Connection,
    credential_id: &str,
    clear: &mut C,
) -> Result<(), IntegrationCredentialError>
where
    C: FnMut(&str) -> Result<(), secrets::SecretError>,
{
    let bound: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM integration_bindings WHERE credential_id = ?1 LIMIT 1",
            rusqlite::params![credential_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(store_err)?;
    if bound.is_some() {
        return Ok(());
    }
    conn.execute(
        "DELETE FROM integration_credentials WHERE id = ?1",
        rusqlite::params![credential_id],
    )
    .map_err(store_err)?;
    clear(&secret_key(credential_id))?;
    Ok(())
}

pub(crate) fn github_clear_token(
    workspace_id: Option<&str>,
) -> Result<(), IntegrationCredentialError> {
    let conn = open_db()?;
    github_clear_token_with(&conn, workspace_id, shared_cache(), secrets::clear)
}

fn github_clear_token_with<C>(
    conn: &Connection,
    workspace_id: Option<&str>,
    cache: &SecretCache,
    mut clear: C,
) -> Result<(), IntegrationCredentialError>
where
    C: FnMut(&str) -> Result<(), secrets::SecretError>,
{
    match workspace_id.filter(|id| !id.is_empty()) {
        Some(ws) => {
            let Some(credential_id) = credential_id_for_binding(conn, GITHUB_PROVIDER, ws, None)?
            else {
                clear(&github_legacy_key(ws))?;
                return Ok(());
            };
            evict(cache, &credential_id);
            conn.execute(
                "DELETE FROM integration_bindings
                 WHERE workspace_id = ?1 AND provider = 'github'",
                rusqlite::params![ws],
            )
            .map_err(store_err)?;
            delete_credential_if_unbound(conn, &credential_id, &mut clear)?;
            clear(&github_legacy_key(ws))?;
        }
        None => {
            if let Some(credential_id) = global_credential_id(conn, GITHUB_PROVIDER)? {
                evict(cache, &credential_id);
                conn.execute(
                    "DELETE FROM integration_credentials WHERE id = ?1",
                    rusqlite::params![credential_id],
                )
                .map_err(store_err)?;
                clear(&secret_key(&credential_id))?;
            }
            clear(GITHUB_LEGACY_KEY)?;
        }
    }
    Ok(())
}

pub(crate) fn github_scoped(workspace_id: &str) -> bool {
    let Ok(conn) = open_db() else {
        return false;
    };
    credential_id_for_binding(&conn, GITHUB_PROVIDER, workspace_id, None)
        .ok()
        .flatten()
        .is_some()
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

fn adopt_github_with<R, W, C>(
    conn: &Connection,
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
    if let Some(secret) = read(GITHUB_LEGACY_KEY)? {
        let credential_id = match global_credential_id(conn, GITHUB_PROVIDER)? {
            Some(id) => id,
            None => {
                let id = new_id(conn)?;
                insert_github_credential(conn, &id)?;
                id
            }
        };
        let target = secret_key(&credential_id);
        if read(&target)?.is_none() {
            write(&target, &secret)?;
        }
        clear(GITHUB_LEGACY_KEY)?;
        adopted += 1;
    }

    let projects: Vec<(String, String)> = {
        let mut stmt = conn
            .prepare("SELECT id, workspace_id FROM projects WHERE workspace_id IS NOT NULL")
            .map_err(store_err)?;
        let rows = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(store_err)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(store_err)?
    };
    for (project_id, container_id) in projects {
        let legacy = github_legacy_key(&project_id);
        let Some(secret) = read(&legacy)? else {
            continue;
        };
        let scope = if github_binding_exists(conn, &container_id, None)? {
            Some(project_id.as_str())
        } else {
            None
        };
        if github_binding_exists(conn, &container_id, scope)? {
            clear(&legacy)?;
            continue;
        }
        let credential_id = new_id(conn)?;
        insert_github_credential(conn, &credential_id)?;
        insert_github_binding(conn, &container_id, scope, &credential_id)?;
        write(&secret_key(&credential_id), &secret)?;
        clear(&legacy)?;
        adopted += 1;
    }
    Ok(adopted)
}

#[tauri::command(async)]
pub fn integration_credentials_adopt() -> Result<usize, IntegrationCredentialError> {
    let bindings = legacy_bindings_in_db()?;
    let legacy = adopt_with(&bindings, secrets::read, secrets::set, secrets::clear)?;
    let conn = open_db()?;
    let github = adopt_github_with(&conn, secrets::read, secrets::set, secrets::clear)?;
    sweep_orphan_credentials(&conn, secrets::read)?;
    Ok(legacy + github)
}

fn sweep_orphan_credentials<R>(
    conn: &Connection,
    mut read_secret: R,
) -> Result<usize, IntegrationCredentialError>
where
    R: FnMut(&str) -> Result<Option<String>, secrets::SecretError>,
{
    let mut stmt = conn
        .prepare(
            "SELECT c.id FROM integration_credentials c
             WHERE NOT EXISTS (SELECT 1 FROM integration_bindings b WHERE b.credential_id = c.id)",
        )
        .map_err(store_err)?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(store_err)?;
    let unbound = rows.collect::<Result<Vec<_>, _>>().map_err(store_err)?;
    let mut swept = 0;
    for credential_id in unbound {
        if read_secret(&secret_key(&credential_id))?.is_some() {
            continue;
        }
        conn.execute(
            "DELETE FROM integration_credentials WHERE id = ?1",
            rusqlite::params![credential_id],
        )
        .map_err(store_err)?;
        swept += 1;
    }
    Ok(swept)
}

#[tauri::command]
pub async fn integration_credential_has_secret(
    credential_id: String,
) -> Result<bool, IntegrationCredentialError> {
    tauri::async_runtime::spawn_blocking(move || {
        integration_credential_has_secret_blocking(credential_id)
    })
    .await
    .map_err(|e| IntegrationCredentialError::Io(std::io::Error::other(e.to_string())))?
}

fn integration_credential_has_secret_blocking(
    credential_id: String,
) -> Result<bool, IntegrationCredentialError> {
    if credential_id.is_empty() {
        return Err(IntegrationCredentialError::MissingCredential);
    }
    Ok(secrets::read(&secret_key(&credential_id))?.is_some())
}

#[tauri::command]
pub async fn integration_credential_forget(
    credential_id: String,
) -> Result<(), IntegrationCredentialError> {
    tauri::async_runtime::spawn_blocking(move || {
        integration_credential_forget_blocking(credential_id)
    })
    .await
    .map_err(|e| IntegrationCredentialError::Io(std::io::Error::other(e.to_string())))?
}

fn integration_credential_forget_blocking(
    credential_id: String,
) -> Result<(), IntegrationCredentialError> {
    if credential_id.is_empty() {
        return Err(IntegrationCredentialError::MissingCredential);
    }
    forget_with(&credential_id, shared_cache(), secrets::clear)
}

fn forget_with<C>(
    credential_id: &str,
    cache: &SecretCache,
    clear: C,
) -> Result<(), IntegrationCredentialError>
where
    C: FnOnce(&str) -> Result<(), secrets::SecretError>,
{
    evict(cache, credential_id);
    clear(&secret_key(credential_id))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_provider_cache_is_the_one_shared_store() {
        let caches = [
            crate::bitbucket::BitbucketTokenCache::new().0,
            crate::gitlab::GitlabTokenCache::new().0,
            crate::jira::JiraTokenCache::new().0,
            crate::linear::LinearTokenCache::new().0,
            crate::sentry::SentryTokenCache::new().0,
            crate::slack::SlackTokenCache::new().0,
        ];
        for held in caches {
            assert!(std::ptr::eq(held, shared_cache()));
        }
    }

    #[test]
    fn forgetting_evicts_even_when_the_keychain_clear_fails() {
        let cache = cache();
        remember(&cache, "cred-1", "lin_api_stored");

        let outcome = forget_with("cred-1", &cache, |_| Err(secrets::SecretError::InvalidKey));

        assert!(outcome.is_err());
        assert!(cached(&cache, "cred-1").is_none());
    }

    use std::cell::RefCell;

    fn cache() -> SecretCache {
        Mutex::new(HashMap::new())
    }

    #[test]
    fn storing_a_github_token_twice_serves_the_new_token() {
        let conn = test_conn();
        let cache = cache();
        let keychain = RefCell::new(HashMap::<String, String>::new());
        let set = |key: &str, value: &str| {
            keychain
                .borrow_mut()
                .insert(key.to_string(), value.to_string());
            Ok(())
        };

        github_store_token_with(&conn, Some("w1"), "ghp_old_harborline", &cache, set).unwrap();
        let credential_id = credential_id_for_binding(&conn, GITHUB_PROVIDER, "w1", None)
            .unwrap()
            .unwrap();
        assert_eq!(
            cached(&cache, &credential_id).as_deref(),
            Some("ghp_old_harborline")
        );

        github_store_token_with(&conn, Some("w1"), "ghp_new_harborline", &cache, set).unwrap();
        assert_eq!(
            cached(&cache, &credential_id).as_deref(),
            Some("ghp_new_harborline")
        );
        assert_eq!(
            keychain.borrow().get(&secret_key(&credential_id)).cloned(),
            Some("ghp_new_harborline".to_string())
        );
    }

    #[test]
    fn a_failed_keychain_write_keeps_the_old_cached_token() {
        let conn = test_conn();
        let cache = cache();
        github_store_token_with(&conn, None, "ghp_old_harborline", &cache, |_, _| Ok(())).unwrap();
        let credential_id = global_credential_id(&conn, GITHUB_PROVIDER)
            .unwrap()
            .unwrap();

        let outcome = github_store_token_with(&conn, None, "ghp_new_harborline", &cache, |_, _| {
            Err(secrets::SecretError::InvalidKey)
        });

        assert!(outcome.is_err());
        assert_eq!(
            cached(&cache, &credential_id).as_deref(),
            Some("ghp_old_harborline")
        );
    }

    #[test]
    fn clearing_a_github_token_evicts_the_cached_secret() {
        let conn = test_conn();
        let cache = cache();
        github_store_token_with(&conn, Some("w1"), "ghp_old_harborline", &cache, |_, _| {
            Ok(())
        })
        .unwrap();
        let credential_id = credential_id_for_binding(&conn, GITHUB_PROVIDER, "w1", None)
            .unwrap()
            .unwrap();

        github_clear_token_with(&conn, Some("w1"), &cache, |_| Ok(())).unwrap();

        assert!(cached(&cache, &credential_id).is_none());
    }

    #[test]
    fn clearing_the_global_github_token_evicts_the_cached_secret() {
        let conn = test_conn();
        let cache = cache();
        github_store_token_with(&conn, None, "ghp_old_harborline", &cache, |_, _| Ok(())).unwrap();
        let credential_id = global_credential_id(&conn, GITHUB_PROVIDER)
            .unwrap()
            .unwrap();

        github_clear_token_with(&conn, None, &cache, |_| Ok(())).unwrap();

        assert!(cached(&cache, &credential_id).is_none());
    }

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(
            "CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT);
             CREATE TABLE projects (id TEXT PRIMARY KEY, workspace_id TEXT);
             CREATE TABLE integration_credentials (
               id TEXT PRIMARY KEY,
               provider TEXT NOT NULL,
               label TEXT NOT NULL,
               account TEXT NOT NULL DEFAULT '',
               created_at INTEGER NOT NULL,
               updated_at INTEGER NOT NULL
             );
             CREATE TABLE integration_bindings (
               id TEXT PRIMARY KEY,
               workspace_id TEXT NOT NULL,
               project_id TEXT,
               provider TEXT NOT NULL,
               credential_id TEXT NOT NULL,
               config TEXT NOT NULL DEFAULT '{}',
               created_at INTEGER NOT NULL,
               updated_at INTEGER NOT NULL
             );",
        )
        .expect("schema");
        conn
    }

    fn seed_credential(conn: &Connection, id: &str, provider: &str) {
        conn.execute(
            "INSERT INTO integration_credentials (id, provider, label, account, created_at, updated_at)
             VALUES (?1, ?2, ?1, '', 1, 1)",
            rusqlite::params![id, provider],
        )
        .expect("credential");
    }

    fn seed_binding(
        conn: &Connection,
        id: &str,
        workspace: &str,
        project: Option<&str>,
        provider: &str,
        credential: &str,
    ) {
        conn.execute(
            "INSERT INTO integration_bindings (id, workspace_id, project_id, provider, credential_id, config, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, '{}', 1, 1)",
            rusqlite::params![id, workspace, project, provider, credential],
        )
        .expect("binding");
    }

    fn keyed_conn(name: &str) -> (Connection, std::path::PathBuf) {
        let dir =
            std::env::temp_dir().join(format!("goodboy-credentials-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let conn = db::open_connection(&dir.join("data.db")).expect("connection");
        conn.execute_batch(
            "CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT);
             CREATE TABLE integration_credentials (
               id TEXT PRIMARY KEY,
               provider TEXT NOT NULL,
               label TEXT NOT NULL,
               account TEXT NOT NULL DEFAULT '',
               created_at INTEGER NOT NULL,
               updated_at INTEGER NOT NULL
             );
             CREATE TABLE integration_bindings (
               id TEXT PRIMARY KEY,
               workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
               project_id TEXT,
               provider TEXT NOT NULL,
               credential_id TEXT NOT NULL REFERENCES integration_credentials(id) ON DELETE RESTRICT,
               config TEXT NOT NULL DEFAULT '{}',
               created_at INTEGER NOT NULL,
               updated_at INTEGER NOT NULL
             );
             INSERT INTO workspaces (id, name) VALUES ('ws-1', 'Harborline');",
        )
        .expect("schema");
        (conn, dir)
    }

    #[test]
    fn a_bound_credential_is_refused_by_the_database_not_orphaned() {
        let (conn, dir) = keyed_conn("bound");
        seed_credential(&conn, "cred-1", "linear");
        seed_binding(&conn, "bind-1", "ws-1", None, "linear", "cred-1");

        let refused = conn.execute(
            "DELETE FROM integration_credentials WHERE id = 'cred-1'",
            [],
        );

        assert!(refused.is_err());
        let bindings: i64 = conn
            .query_row("SELECT COUNT(*) FROM integration_bindings", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(bindings, 1);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn dropping_the_bindings_first_lets_the_credential_go_and_a_shared_one_stays() {
        let (conn, dir) = keyed_conn("unbound");
        seed_credential(&conn, "cred-1", "linear");
        seed_credential(&conn, "cred-2", "linear");
        seed_binding(&conn, "bind-1", "ws-1", None, "linear", "cred-1");
        seed_binding(&conn, "bind-2", "ws-1", Some("proj-1"), "linear", "cred-2");
        seed_binding(&conn, "bind-3", "ws-1", Some("proj-2"), "linear", "cred-2");

        conn.execute("DELETE FROM integration_bindings WHERE id = 'bind-1'", [])
            .unwrap();
        conn.execute(
            "DELETE FROM integration_credentials WHERE id = 'cred-1'",
            [],
        )
        .unwrap();
        conn.execute("DELETE FROM integration_bindings WHERE id = 'bind-2'", [])
            .unwrap();
        let shared = conn.execute(
            "DELETE FROM integration_credentials WHERE id = 'cred-2'",
            [],
        );

        assert!(shared.is_err());
        let left: Vec<String> = conn
            .prepare("SELECT id FROM integration_credentials")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(left, vec!["cred-2"]);
        let _ = std::fs::remove_dir_all(dir);
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
    fn a_project_override_wins_over_the_workspace_binding() {
        let conn = test_conn();
        seed_credential(&conn, "cred-ws", "linear");
        seed_credential(&conn, "cred-proj", "linear");
        seed_binding(&conn, "b-ws", "container-1", None, "linear", "cred-ws");
        seed_binding(
            &conn,
            "b-proj",
            "container-1",
            Some("project-1"),
            "linear",
            "cred-proj",
        );

        let with_override =
            credential_id_for_binding(&conn, "linear", "container-1", Some("project-1"))
                .expect("resolves");
        let without =
            credential_id_for_binding(&conn, "linear", "container-1", None).expect("resolves");
        let other_project =
            credential_id_for_binding(&conn, "linear", "container-1", Some("project-2"))
                .expect("resolves");

        assert_eq!(with_override.as_deref(), Some("cred-proj"));
        assert_eq!(without.as_deref(), Some("cred-ws"));
        assert_eq!(other_project.as_deref(), Some("cred-ws"));
    }

    #[test]
    fn a_project_override_is_read_even_when_the_workspace_key_is_gone() {
        let conn = test_conn();
        seed_credential(&conn, "cred-dead", "linear");
        seed_credential(&conn, "cred-live", "linear");
        seed_binding(&conn, "b-ws", "container-1", None, "linear", "cred-dead");
        seed_binding(
            &conn,
            "b-proj",
            "container-1",
            Some("ledger-core"),
            "linear",
            "cred-live",
        );
        let read = |id: &str| match id {
            "cred-live" => Ok(Some("live-token".to_string())),
            _ => Ok(None),
        };

        let scoped = resolve_and_read(&conn, "linear", "container-1", Some("ledger-core"), read)
            .expect("resolves");
        let unscoped = resolve_and_read(&conn, "linear", "container-1", None, read);

        assert_eq!(scoped.as_deref(), Some("live-token"));
        assert!(matches!(
            unscoped,
            Err(IntegrationCredentialError::MissingSecret { ref credential_id, .. })
                if credential_id == "cred-dead"
        ));
    }

    #[test]
    fn a_bound_credential_without_a_key_never_borrows_another_account() {
        let conn = test_conn();
        seed_credential(&conn, "cred-bound", "linear");
        seed_credential(&conn, "cred-free", "linear");
        seed_binding(&conn, "b-ws", "container-1", None, "linear", "cred-bound");
        let read = |id: &str| match id {
            "cred-free" => Ok(Some("someone-elses-token".to_string())),
            _ => Ok(None),
        };

        let resolved = resolve_and_read(&conn, "linear", "container-1", None, read);

        assert!(matches!(
            resolved,
            Err(IntegrationCredentialError::MissingSecret { .. })
        ));
    }

    #[test]
    fn store_then_forget_then_read_is_a_missing_secret() {
        let cache = cache();
        let keychain = RefCell::new(HashMap::new());
        let conn = test_conn();
        seed_credential(&conn, "cred-1", "linear");
        seed_binding(&conn, "b-ws", "container-1", None, "linear", "cred-1");
        keychain
            .borrow_mut()
            .insert(secret_key("cred-1"), "lin_api_stored".to_string());
        let read = |id: &str| -> Result<Option<String>, secrets::SecretError> {
            if let Some(hit) = cached(&cache, id) {
                return Ok(Some(hit));
            }
            let found = keychain.borrow().get(&secret_key(id)).cloned();
            if let Some(secret) = found.as_deref() {
                remember(&cache, id, secret);
            }
            Ok(found)
        };
        let before = resolve_and_read(&conn, "linear", "container-1", None, read).expect("reads");
        assert_eq!(before.as_deref(), Some("lin_api_stored"));

        forget_with("cred-1", &cache, |key| {
            keychain.borrow_mut().remove(key);
            Ok(())
        })
        .expect("forgets");

        assert!(matches!(
            resolve_and_read(&conn, "linear", "container-1", None, read),
            Err(IntegrationCredentialError::MissingSecret { .. })
        ));
    }

    #[test]
    fn the_unbound_tier_skips_a_credential_it_cannot_read() {
        let conn = test_conn();
        seed_credential(&conn, "cred-newer", "linear");
        seed_credential(&conn, "cred-older", "linear");
        conn.execute(
            "UPDATE integration_credentials SET updated_at = 2 WHERE id = 'cred-newer'",
            [],
        )
        .expect("touch");
        let read = |id: &str| match id {
            "cred-older" => Ok(Some("older-token".to_string())),
            _ => Ok(None),
        };

        let resolved =
            resolve_and_read(&conn, "linear", "container-1", None, read).expect("resolves");

        assert_eq!(resolved.as_deref(), Some("older-token"));
    }

    #[test]
    fn a_scope_with_no_binding_and_no_credential_resolves_to_nothing() {
        let conn = test_conn();

        let resolved =
            resolve_and_read(&conn, "linear", "container-1", None, |_| Ok(None)).expect("resolves");

        assert_eq!(resolved, None);
    }

    #[test]
    fn the_sweep_drops_only_credentials_nothing_claims_and_nothing_backs() {
        let conn = test_conn();
        seed_credential(&conn, "cred-bound-dead", "linear");
        seed_credential(&conn, "cred-free-dead", "linear");
        seed_credential(&conn, "cred-free-live", "linear");
        seed_binding(
            &conn,
            "b-ws",
            "container-1",
            None,
            "linear",
            "cred-bound-dead",
        );
        let read = |key: &str| match key {
            "goodboy.credential.cred-free-live" => Ok(Some("live".to_string())),
            _ => Ok(None),
        };

        let swept = sweep_orphan_credentials(&conn, read).expect("sweeps");
        let again = sweep_orphan_credentials(&conn, read).expect("sweeps");
        let left = conn
            .prepare("SELECT id FROM integration_credentials ORDER BY id")
            .expect("prepare")
            .query_map([], |row| row.get::<_, String>(0))
            .expect("query")
            .collect::<Result<Vec<_>, _>>()
            .expect("rows");

        assert_eq!(swept, 1);
        assert_eq!(again, 0);
        assert_eq!(left, vec!["cred-bound-dead", "cred-free-live"]);
    }

    #[test]
    fn the_global_fallback_is_a_credential_no_binding_references() {
        let conn = test_conn();
        seed_credential(&conn, "cred-bound", "github");
        seed_credential(&conn, "cred-free", "github");
        seed_binding(&conn, "b-1", "container-1", None, "github", "cred-bound");

        let global = global_credential_id(&conn, "github").expect("resolves");
        let missing =
            credential_id_for_binding(&conn, "github", "container-2", None).expect("resolves");

        assert_eq!(global.as_deref(), Some("cred-free"));
        assert_eq!(missing, None);
    }

    #[test]
    fn the_scoped_config_follows_the_same_project_then_workspace_order() {
        let conn = test_conn();
        seed_credential(&conn, "cred-1", "gitlab");
        conn.execute(
            "INSERT INTO integration_bindings (id, workspace_id, project_id, provider, credential_id, config, created_at, updated_at)
             VALUES ('b-ws', 'container-1', NULL, 'gitlab', 'cred-1', '{\"host\":\"shared\"}', 1, 1)",
            [],
        )
        .expect("workspace binding");
        conn.execute(
            "INSERT INTO integration_bindings (id, workspace_id, project_id, provider, credential_id, config, created_at, updated_at)
             VALUES ('b-p', 'container-1', 'project-1', 'gitlab', 'cred-1', '{\"host\":\"own\"}', 1, 1)",
            [],
        )
        .expect("project binding");

        let own = config_for_binding_in(&conn, "gitlab", "container-1", Some("project-1"))
            .expect("resolves");
        let shared = config_for_binding_in(&conn, "gitlab", "container-1", None).expect("resolves");

        assert_eq!(own.as_deref(), Some("{\"host\":\"own\"}"));
        assert_eq!(shared.as_deref(), Some("{\"host\":\"shared\"}"));
    }

    #[test]
    fn a_caller_value_equal_to_the_binding_is_accepted() {
        let config = "{\"siteUrl\":\"https://acme.atlassian.net\",\"email\":\"Dev@Acme.test\"}";
        let result = check_bound(
            "jira",
            Some(config),
            &[
                BoundValue {
                    key: "siteUrl",
                    supplied: " https://ACME.atlassian.net/ ",
                },
                BoundValue {
                    key: "email",
                    supplied: "dev@acme.test",
                },
            ],
        );

        assert!(result.is_ok());
    }

    #[test]
    fn a_caller_host_different_from_the_binding_is_rejected() {
        let config = "{\"host\":\"https://gitlab.acme.test\"}";
        let result = check_bound(
            "gitlab",
            Some(config),
            &[BoundValue {
                key: "host",
                supplied: "https://collector.example.test",
            }],
        );

        assert!(matches!(
            result,
            Err(IntegrationCredentialError::UnboundValue { .. })
        ));
    }

    #[test]
    fn a_value_is_rejected_when_the_binding_holds_no_config_or_key() {
        let value = [BoundValue {
            key: "workspaceSlug",
            supplied: "acme",
        }];

        assert!(check_bound("bitbucket", None, &value).is_err());
        assert!(check_bound("bitbucket", Some("{}"), &value).is_err());
        assert!(check_bound("bitbucket", Some("not json"), &value).is_err());
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

    fn run_github_adoption(conn: &Connection, store: &RefCell<HashMap<String, String>>) -> usize {
        adopt_github_with(
            conn,
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
        .expect("github adoption")
    }

    #[test]
    fn the_plain_github_pat_becomes_a_global_credential() {
        let conn = test_conn();
        let store = RefCell::new(HashMap::from([(
            "github.pat".to_string(),
            "ghp_global".to_string(),
        )]));

        let adopted = run_github_adoption(&conn, &store);

        assert_eq!(adopted, 1);
        let remaining = store.into_inner();
        assert!(!remaining.contains_key("github.pat"));
        let (id, secret) = remaining.into_iter().next().expect("one secret");
        assert!(id.starts_with("goodboy.credential."));
        assert_eq!(secret, "ghp_global");
        let global = global_credential_id(&conn, "github").expect("global");
        assert_eq!(secret_key(&global.expect("credential")), id);
    }

    #[test]
    fn a_workspace_scoped_github_pat_binds_to_the_container_of_its_ex_workspace() {
        let conn = test_conn();
        conn.execute(
            "INSERT INTO projects (id, workspace_id) VALUES ('ex-ws-1', 'container-1')",
            [],
        )
        .expect("project");
        let store = RefCell::new(HashMap::from([(
            "github.pat.ex-ws-1".to_string(),
            "ghp_scoped".to_string(),
        )]));

        let adopted = run_github_adoption(&conn, &store);

        assert_eq!(adopted, 1);
        let credential = credential_id_for_binding(&conn, "github", "container-1", None)
            .expect("resolves")
            .expect("bound");
        assert_eq!(
            store
                .borrow()
                .get(&secret_key(&credential))
                .map(String::as_str),
            Some("ghp_scoped")
        );
        assert!(!store.borrow().contains_key("github.pat.ex-ws-1"));
    }

    #[test]
    fn two_ex_workspaces_of_one_container_keep_both_pats() {
        let conn = test_conn();
        conn.execute_batch(
            "INSERT INTO projects (id, workspace_id) VALUES ('ex-a', 'container-1');
             INSERT INTO projects (id, workspace_id) VALUES ('ex-b', 'container-1');",
        )
        .expect("projects");
        let store = RefCell::new(HashMap::from([
            ("github.pat.ex-a".to_string(), "ghp_a".to_string()),
            ("github.pat.ex-b".to_string(), "ghp_b".to_string()),
        ]));

        let adopted = run_github_adoption(&conn, &store);

        assert_eq!(adopted, 2);
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM integration_bindings WHERE provider = 'github'",
                [],
                |row| row.get(0),
            )
            .expect("count");
        assert_eq!(count, 2);
        let overrides: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM integration_bindings WHERE provider = 'github' AND project_id IS NOT NULL",
                [],
                |row| row.get(0),
            )
            .expect("count");
        assert_eq!(overrides, 1);
    }

    #[test]
    fn github_adoption_run_twice_changes_nothing_the_second_time() {
        let conn = test_conn();
        conn.execute(
            "INSERT INTO projects (id, workspace_id) VALUES ('ex-ws-1', 'container-1')",
            [],
        )
        .expect("project");
        let store = RefCell::new(HashMap::from([
            ("github.pat".to_string(), "ghp_global".to_string()),
            ("github.pat.ex-ws-1".to_string(), "ghp_scoped".to_string()),
        ]));

        assert_eq!(run_github_adoption(&conn, &store), 2);
        assert_eq!(run_github_adoption(&conn, &store), 0);
        let credentials: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM integration_credentials WHERE provider = 'github'",
                [],
                |row| row.get(0),
            )
            .expect("count");
        assert_eq!(credentials, 2);
    }

    #[test]
    fn a_pat_of_a_deleted_ex_workspace_is_left_where_it_is() {
        let conn = test_conn();
        let store = RefCell::new(HashMap::from([(
            "github.pat.gone-ws".to_string(),
            "ghp_orphan".to_string(),
        )]));

        let adopted = run_github_adoption(&conn, &store);

        assert_eq!(adopted, 0);
        assert!(store.borrow().contains_key("github.pat.gone-ws"));
    }
}
