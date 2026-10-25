use crate::util::MessageError;
use serde::Serialize;
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ApiKeyStatus {
    Valid,
    Rejected,
    Unchecked,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyCheck {
    pub status: ApiKeyStatus,
    pub message: Option<String>,
}

fn verdict(status: ApiKeyStatus, message: Option<&str>) -> ApiKeyCheck {
    ApiKeyCheck {
        status,
        message: message.map(str::to_string),
    }
}

enum Probe {
    Header {
        url: &'static str,
        headers: Vec<(&'static str, String)>,
    },
    Skip,
}

fn probe_for(provider_id: &str, api_key: &str) -> Probe {
    match provider_id {
        "anthropic" => Probe::Header {
            url: "https://api.anthropic.com/v1/models?limit=1",
            headers: vec![
                ("x-api-key", api_key.to_string()),
                ("anthropic-version", "2023-06-01".to_string()),
            ],
        },
        "codex" => Probe::Header {
            url: "https://api.openai.com/v1/models",
            headers: vec![("authorization", format!("Bearer {api_key}"))],
        },
        "gemini" => Probe::Header {
            url: "https://generativelanguage.googleapis.com/v1beta/models",
            headers: vec![("x-goog-api-key", api_key.to_string())],
        },
        "openrouter" => Probe::Header {
            url: "https://openrouter.ai/api/v1/auth/key",
            headers: vec![("authorization", format!("Bearer {api_key}"))],
        },
        "moonshot" => Probe::Header {
            url: "https://api.moonshot.ai/v1/models",
            headers: vec![("authorization", format!("Bearer {api_key}"))],
        },
        _ => Probe::Skip,
    }
}

fn check_for_http_status(status: u16) -> ApiKeyCheck {
    match status {
        200..=299 => verdict(ApiKeyStatus::Valid, None),
        401 | 403 => verdict(
            ApiKeyStatus::Rejected,
            Some("API key rejected (unauthorized)"),
        ),
        429 => verdict(
            ApiKeyStatus::Unchecked,
            Some("rate limited; the key could not be confirmed"),
        ),
        other => verdict(
            ApiKeyStatus::Unchecked,
            Some(&format!(
                "provider returned HTTP {other}; the key could not be confirmed"
            )),
        ),
    }
}

fn check_for_transport_failure(error: &reqwest::Error) -> ApiKeyCheck {
    let message = match (error.is_timeout(), error.is_connect()) {
        (true, _) => "the provider did not answer in time; the key could not be confirmed",
        (false, true) => "the provider could not be reached; the key could not be confirmed",
        (false, false) => "the request to the provider failed; the key could not be confirmed",
    };
    verdict(ApiKeyStatus::Unchecked, Some(message))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn moonshot_probes_its_own_model_list() {
        match probe_for("moonshot", "sk-test") {
            Probe::Header { url, headers } => {
                assert_eq!(url, "https://api.moonshot.ai/v1/models");
                assert_eq!(
                    headers,
                    vec![("authorization", "Bearer sk-test".to_string())]
                );
            }
            _ => panic!("moonshot must not fall through to Probe::Skip"),
        }
    }

    #[test]
    fn gemini_sends_its_key_in_a_header_never_in_the_url() {
        match probe_for("gemini", "AIza-test") {
            Probe::Header { url, headers } => {
                assert!(!url.contains("AIza-test"));
                assert!(!url.contains('?'));
                assert_eq!(headers, vec![("x-goog-api-key", "AIza-test".to_string())]);
            }
            Probe::Skip => panic!("gemini must be probed"),
        }
    }

    #[test]
    fn an_unknown_provider_still_skips_the_probe() {
        assert!(matches!(probe_for("whatever", "sk-test"), Probe::Skip));
    }

    #[test]
    fn the_three_states_follow_the_http_status() {
        assert_eq!(check_for_http_status(200).status, ApiKeyStatus::Valid);
        assert_eq!(check_for_http_status(401).status, ApiKeyStatus::Rejected);
        assert_eq!(check_for_http_status(403).status, ApiKeyStatus::Rejected);
        assert_eq!(check_for_http_status(429).status, ApiKeyStatus::Unchecked);
        assert_eq!(check_for_http_status(503).status, ApiKeyStatus::Unchecked);
    }

    #[test]
    fn the_states_serialize_as_lowercase_words() {
        let json = serde_json::to_value(check_for_http_status(401)).expect("serializes");
        assert_eq!(json["status"], "rejected");
        let json = serde_json::to_value(check_for_http_status(200)).expect("serializes");
        assert_eq!(json["status"], "valid");
        let json = serde_json::to_value(check_for_http_status(500)).expect("serializes");
        assert_eq!(json["status"], "unchecked");
    }

    #[tokio::test]
    async fn a_transport_failure_never_carries_the_key() {
        let key = "AIza-never-in-a-message";
        let error = reqwest::Client::new()
            .get(format!("http://127.0.0.1:1/models?key={key}"))
            .timeout(Duration::from_secs(2))
            .send()
            .await
            .expect_err("nothing listens on port 1");
        assert!(error.to_string().contains(key));

        let check = check_for_transport_failure(&error);

        assert_eq!(check.status, ApiKeyStatus::Unchecked);
        let message = check.message.expect("message");
        assert!(!message.contains(key));
        assert!(!message.contains("127.0.0.1"));
    }
}

#[tauri::command]
pub async fn provider_api_key_validate(
    provider_id: String,
    api_key: String,
) -> Result<ApiKeyCheck, MessageError> {
    let key = api_key.trim();
    if key.is_empty() {
        return Ok(verdict(ApiKeyStatus::Rejected, Some("API key is empty")));
    }

    let Probe::Header { url, headers } = probe_for(&provider_id, key) else {
        return Ok(verdict(
            ApiKeyStatus::Unchecked,
            Some("this provider has no key check; the key was not verified"),
        ));
    };
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|_| "could not prepare the key check".to_string())?;

    let mut request = client.get(url);
    for (name, value) in headers {
        request = request.header(name, value);
    }

    match request.send().await {
        Ok(response) => Ok(check_for_http_status(response.status().as_u16())),
        Err(error) => Ok(check_for_transport_failure(&error)),
    }
}
