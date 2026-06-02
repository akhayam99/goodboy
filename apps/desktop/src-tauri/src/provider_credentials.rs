use serde::Serialize;
use std::time::Duration;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyCheck {
    pub valid: bool,
    pub message: Option<String>,
}

enum Probe {
    Header {
        url: &'static str,
        headers: Vec<(&'static str, String)>,
    },
    Query {
        base: &'static str,
        key: String,
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
        "gemini" => Probe::Query {
            base: "https://generativelanguage.googleapis.com/v1beta/models",
            key: api_key.to_string(),
        },
        _ => Probe::Skip,
    }
}

#[tauri::command]
pub async fn provider_api_key_validate(
    provider_id: String,
    api_key: String,
) -> Result<ApiKeyCheck, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Ok(ApiKeyCheck {
            valid: false,
            message: Some("API key is empty".to_string()),
        });
    }

    let probe = probe_for(&provider_id, key);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let request = match probe {
        Probe::Skip => {
            return Ok(ApiKeyCheck {
                valid: true,
                message: None,
            });
        }
        Probe::Header { url, headers } => {
            let mut req = client.get(url);
            for (name, value) in headers {
                req = req.header(name, value);
            }
            req
        }
        Probe::Query { base, key } => client.get(base).query(&[("key", key.as_str())]),
    };

    let response = request.send().await.map_err(|e| e.to_string())?;
    let status = response.status();
    if status.is_success() {
        return Ok(ApiKeyCheck {
            valid: true,
            message: None,
        });
    }

    let message = match status.as_u16() {
        401 | 403 => "API key rejected (unauthorized)".to_string(),
        429 => "rate limited; key looks valid but could not confirm".to_string(),
        other => format!("provider returned HTTP {other}"),
    };
    Ok(ApiKeyCheck {
        valid: status.as_u16() == 429,
        message: Some(message),
    })
}
