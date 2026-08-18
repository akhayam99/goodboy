use thiserror::Error;

use crate::secrets;

#[derive(Debug, Error)]
pub enum IntegrationCredentialError {
    #[error("unknown integration provider: {0}")]
    UnknownProvider(String),
    #[error("a workspace id is required on both sides of a reuse")]
    MissingWorkspace,
    #[error("a workspace cannot reuse the credential it already holds")]
    SameWorkspace,
    #[error("no {0} credential stored for the workspace it would be copied from")]
    NoCredential(String),
    #[error("secret store error: {0}")]
    Secret(#[from] secrets::SecretError),
}

crate::util::impl_error_serialize!(IntegrationCredentialError);

impl IntegrationCredentialError {
    fn kind(&self) -> &'static str {
        match self {
            IntegrationCredentialError::UnknownProvider(_) => "unknown_provider",
            IntegrationCredentialError::MissingWorkspace => "missing_workspace",
            IntegrationCredentialError::SameWorkspace => "same_workspace",
            IntegrationCredentialError::NoCredential(_) => "no_credential",
            IntegrationCredentialError::Secret(_) => "secret",
        }
    }
}

fn credential_key(provider: &str, workspace_id: &str) -> Option<String> {
    match provider {
        "linear" => Some(crate::linear::credential_key(workspace_id)),
        "sentry" => Some(crate::sentry::credential_key(workspace_id)),
        "gitlab" => Some(crate::gitlab::credential_key(workspace_id)),
        "jira" => Some(crate::jira::credential_key(workspace_id)),
        "bitbucket" => Some(crate::bitbucket::credential_key(workspace_id)),
        "slack" => Some(crate::slack::credential_key(workspace_id)),
        _ => None,
    }
}

fn reuse_with<R, W>(
    provider: &str,
    from_workspace_id: &str,
    to_workspace_id: &str,
    read: R,
    write: W,
) -> Result<(), IntegrationCredentialError>
where
    R: FnOnce(&str) -> Result<Option<String>, secrets::SecretError>,
    W: FnOnce(&str, &str) -> Result<(), secrets::SecretError>,
{
    if from_workspace_id.is_empty() || to_workspace_id.is_empty() {
        return Err(IntegrationCredentialError::MissingWorkspace);
    }
    if from_workspace_id == to_workspace_id {
        return Err(IntegrationCredentialError::SameWorkspace);
    }
    let source = credential_key(provider, from_workspace_id)
        .ok_or_else(|| IntegrationCredentialError::UnknownProvider(provider.to_string()))?;
    let target = credential_key(provider, to_workspace_id)
        .ok_or_else(|| IntegrationCredentialError::UnknownProvider(provider.to_string()))?;
    let credential = read(&source)?
        .ok_or_else(|| IntegrationCredentialError::NoCredential(provider.to_string()))?;
    write(&target, &credential)?;
    Ok(())
}

#[tauri::command]
pub fn integration_credential_reuse(
    provider: String,
    from_workspace_id: String,
    to_workspace_id: String,
) -> Result<(), IntegrationCredentialError> {
    reuse_with(
        &provider,
        &from_workspace_id,
        &to_workspace_id,
        secrets::read,
        secrets::set,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    fn reader(
        stored: Option<&str>,
    ) -> impl FnOnce(&str) -> Result<Option<String>, secrets::SecretError> + '_ {
        move |_key| Ok(stored.map(|value| value.to_string()))
    }

    #[test]
    fn every_workspace_integration_provider_maps_to_its_own_module_key() {
        assert_eq!(
            credential_key("linear", "ws-1").as_deref(),
            Some(crate::linear::credential_key("ws-1").as_str())
        );
        assert_eq!(
            credential_key("sentry", "ws-1").as_deref(),
            Some(crate::sentry::credential_key("ws-1").as_str())
        );
        assert_eq!(
            credential_key("gitlab", "ws-1").as_deref(),
            Some(crate::gitlab::credential_key("ws-1").as_str())
        );
        assert_eq!(
            credential_key("jira", "ws-1").as_deref(),
            Some(crate::jira::credential_key("ws-1").as_str())
        );
        assert_eq!(
            credential_key("bitbucket", "ws-1").as_deref(),
            Some(crate::bitbucket::credential_key("ws-1").as_str())
        );
        assert_eq!(
            credential_key("slack", "ws-1").as_deref(),
            Some(crate::slack::credential_key("ws-1").as_str())
        );
    }

    #[test]
    fn a_provider_outside_the_known_set_has_no_key() {
        assert_eq!(credential_key("asana", "ws-1"), None);
        assert_eq!(credential_key("github", "ws-1"), None);
    }

    #[test]
    fn a_copy_reads_the_source_key_and_writes_the_target_key_of_the_same_provider() {
        let written = RefCell::new(Vec::new());

        reuse_with(
            "linear",
            "ws-from",
            "ws-to",
            reader(Some("lin_api_x")),
            |key, value| {
                written
                    .borrow_mut()
                    .push((key.to_string(), value.to_string()));
                Ok(())
            },
        )
        .expect("reuse");

        assert_eq!(
            written.into_inner(),
            vec![(
                crate::linear::credential_key("ws-to"),
                "lin_api_x".to_string()
            )]
        );
    }

    #[test]
    fn an_unknown_provider_is_refused_before_the_secret_store_is_touched() {
        let error = reuse_with(
            "asana",
            "ws-from",
            "ws-to",
            |_key| panic!("the secret store must not be read for an unknown provider"),
            |_key, _value| panic!("the secret store must not be written for an unknown provider"),
        )
        .expect_err("unknown provider");

        assert!(matches!(
            error,
            IntegrationCredentialError::UnknownProvider(_)
        ));
    }

    #[test]
    fn reusing_into_the_same_workspace_is_refused() {
        let error = reuse_with(
            "linear",
            "ws-1",
            "ws-1",
            |_key| panic!("the secret store must not be read"),
            |_key, _value| panic!("the secret store must not be written"),
        )
        .expect_err("same workspace");

        assert!(matches!(error, IntegrationCredentialError::SameWorkspace));
    }

    #[test]
    fn an_empty_workspace_id_is_refused_so_no_unscoped_key_is_ever_built() {
        for (from, to) in [("", "ws-to"), ("ws-from", "")] {
            let error = reuse_with(
                "linear",
                from,
                to,
                |_key| panic!("the secret store must not be read"),
                |_key, _value| panic!("the secret store must not be written"),
            )
            .expect_err("missing workspace");

            assert!(matches!(
                error,
                IntegrationCredentialError::MissingWorkspace
            ));
        }
    }

    #[test]
    fn a_source_without_a_stored_credential_writes_nothing() {
        let error = reuse_with(
            "linear",
            "ws-from",
            "ws-to",
            reader(None),
            |_key, _value| panic!("nothing to write without a source credential"),
        )
        .expect_err("no credential");

        assert!(matches!(error, IntegrationCredentialError::NoCredential(_)));
    }

    #[test]
    fn a_missing_credential_names_the_provider_and_never_a_personal_api_key() {
        let slack = reuse_with("slack", "ws-from", "ws-to", reader(None), |_key, _value| {
            panic!("nothing to write without a source credential")
        })
        .expect_err("no credential");

        let message = slack.to_string();
        assert!(message.contains("slack"));
        assert!(!message.contains("personal API key"));
    }
}
