use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;
use thiserror::Error;

use crate::secrets;
use crate::util::epoch_secs_to_datetime;

pub struct SlackTokenCache(Mutex<HashMap<String, String>>);

impl SlackTokenCache {
    pub fn new() -> Self {
        Self(Mutex::new(HashMap::new()))
    }
}

fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(reqwest::Client::new)
}

fn credential_key(workspace_id: &str) -> String {
    format!("goodboy.workspace.{}.slack", workspace_id)
}

const API_BASE: &str = "https://slack.com/api";
const MAX_PAGES: u32 = 20;
const PAGE_LEN: u32 = 200;

const AUTH_HINT: &str = "slack rejected the token. goodboy signs every call with the bot token you pasted as a bearer token, so it has to start with xoxb- and belong to an app installed in this workspace. check that the app grants channels:read, channels:history, users:read, chat:write and reactions:write";

#[derive(Debug, Error)]
pub enum SlackError {
    #[error("http error {status}: {body}")]
    Http { status: u16, body: String },
    #[error("authentication failed: {0}")]
    Auth(String),
    #[error("rate limited: {0}")]
    RateLimited(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("slack refused the call: {0}")]
    Api(String),
    #[error("invalid response shape: {0}")]
    InvalidShape(String),
    #[error("no token stored for workspace {0}")]
    NoToken(String),
    #[error("secret store error: {0}")]
    Secret(#[from] secrets::SecretError),
}

crate::util::impl_error_serialize!(SlackError);

impl SlackError {
    fn kind(&self) -> &'static str {
        match self {
            SlackError::Http { .. } => "http",
            SlackError::Auth(_) => "auth",
            SlackError::RateLimited(_) => "rate_limited",
            SlackError::NotFound(_) => "not_found",
            SlackError::Api(_) => "api",
            SlackError::InvalidShape(_) => "shape",
            SlackError::NoToken(_) => "no_token",
            SlackError::Secret(_) => "secret",
        }
    }
}

impl From<reqwest::Error> for SlackError {
    fn from(e: reqwest::Error) -> Self {
        SlackError::Http {
            status: 0,
            body: e.to_string(),
        }
    }
}

fn percent_encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

struct SlackCall {
    method: reqwest::Method,
    url: String,
    body: Option<Value>,
}

enum SlackCallSpec<'a> {
    AuthTest,
    Channels {
        cursor: Option<&'a str>,
    },
    Users {
        cursor: Option<&'a str>,
    },
    History {
        channel: &'a str,
        cursor: Option<&'a str>,
    },
    Replies {
        channel: &'a str,
        thread_ts: &'a str,
        cursor: Option<&'a str>,
    },
    Permalink {
        channel: &'a str,
        message_ts: &'a str,
    },
    PostReply {
        channel: &'a str,
        thread_ts: &'a str,
        text: &'a str,
    },
    AddReaction {
        channel: &'a str,
        message_ts: &'a str,
        name: &'a str,
    },
}

fn with_cursor(url: String, cursor: Option<&str>) -> String {
    let Some(value) = cursor.map(str::trim).filter(|value| !value.is_empty()) else {
        return url;
    };
    format!("{}&cursor={}", url, percent_encode(value))
}

fn slack_call(base: &str, spec: &SlackCallSpec<'_>) -> SlackCall {
    match spec {
        SlackCallSpec::AuthTest => SlackCall {
            method: reqwest::Method::POST,
            url: format!("{base}/auth.test"),
            body: Some(Value::Object(serde_json::Map::new())),
        },
        SlackCallSpec::Channels { cursor } => SlackCall {
            method: reqwest::Method::GET,
            url: with_cursor(
                format!("{base}/conversations.list?types=public_channel&exclude_archived=true&limit={PAGE_LEN}"),
                *cursor,
            ),
            body: None,
        },
        SlackCallSpec::Users { cursor } => SlackCall {
            method: reqwest::Method::GET,
            url: with_cursor(format!("{base}/users.list?limit={PAGE_LEN}"), *cursor),
            body: None,
        },
        SlackCallSpec::History { channel, cursor } => SlackCall {
            method: reqwest::Method::GET,
            url: with_cursor(
                format!(
                    "{base}/conversations.history?channel={}&limit={PAGE_LEN}",
                    percent_encode(channel)
                ),
                *cursor,
            ),
            body: None,
        },
        SlackCallSpec::Replies {
            channel,
            thread_ts,
            cursor,
        } => SlackCall {
            method: reqwest::Method::GET,
            url: with_cursor(
                format!(
                    "{base}/conversations.replies?channel={}&ts={}&limit={PAGE_LEN}",
                    percent_encode(channel),
                    percent_encode(thread_ts)
                ),
                *cursor,
            ),
            body: None,
        },
        SlackCallSpec::Permalink {
            channel,
            message_ts,
        } => SlackCall {
            method: reqwest::Method::GET,
            url: format!(
                "{base}/chat.getPermalink?channel={}&message_ts={}",
                percent_encode(channel),
                percent_encode(message_ts)
            ),
            body: None,
        },
        SlackCallSpec::PostReply {
            channel,
            thread_ts,
            text,
        } => SlackCall {
            method: reqwest::Method::POST,
            url: format!("{base}/chat.postMessage"),
            body: Some(serde_json::json!({
                "channel": channel,
                "thread_ts": thread_ts,
                "text": text
            })),
        },
        SlackCallSpec::AddReaction {
            channel,
            message_ts,
            name,
        } => SlackCall {
            method: reqwest::Method::POST,
            url: format!("{base}/reactions.add"),
            body: Some(serde_json::json!({
                "channel": channel,
                "timestamp": message_ts,
                "name": name
            })),
        },
    }
}

fn collection_field(spec: &SlackCallSpec<'_>) -> &'static str {
    match spec {
        SlackCallSpec::Channels { .. } => "channels",
        SlackCallSpec::Users { .. } => "members",
        SlackCallSpec::History { .. } | SlackCallSpec::Replies { .. } => "messages",
        _ => "",
    }
}

fn with_cursor_spec<'a>(spec: &SlackCallSpec<'a>, cursor: Option<&'a str>) -> SlackCallSpec<'a> {
    match spec {
        SlackCallSpec::Channels { .. } => SlackCallSpec::Channels { cursor },
        SlackCallSpec::Users { .. } => SlackCallSpec::Users { cursor },
        SlackCallSpec::History { channel, .. } => SlackCallSpec::History { channel, cursor },
        SlackCallSpec::Replies {
            channel, thread_ts, ..
        } => SlackCallSpec::Replies {
            channel,
            thread_ts,
            cursor,
        },
        SlackCallSpec::AuthTest => SlackCallSpec::AuthTest,
        SlackCallSpec::Permalink {
            channel,
            message_ts,
        } => SlackCallSpec::Permalink {
            channel,
            message_ts,
        },
        SlackCallSpec::PostReply {
            channel,
            thread_ts,
            text,
        } => SlackCallSpec::PostReply {
            channel,
            thread_ts,
            text,
        },
        SlackCallSpec::AddReaction {
            channel,
            message_ts,
            name,
        } => SlackCallSpec::AddReaction {
            channel,
            message_ts,
            name,
        },
    }
}

fn error_for_status(status: u16, retry_after: Option<&str>, body: &str) -> Option<SlackError> {
    if status == 429 {
        let delay = retry_after
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("a few");
        return Some(SlackError::RateLimited(format!(
            "slack is rate limiting this workspace, retry after {delay} seconds"
        )));
    }
    if status == 401 || status == 403 {
        return Some(SlackError::Auth(format!("{AUTH_HINT} ({body})")));
    }
    if status == 404 {
        return Some(SlackError::NotFound(body.to_string()));
    }
    if !(200..300).contains(&status) {
        return Some(SlackError::Http {
            status,
            body: body.to_string(),
        });
    }
    None
}

fn envelope_detail(envelope: &Value, token: &str) -> String {
    let needed = envelope
        .get("needed")
        .and_then(Value::as_str)
        .map(str::to_string);
    let Some(needed) = needed.filter(|value| !value.is_empty()) else {
        return token.to_string();
    };
    format!("{token}: {needed}")
}

fn decode_slack_envelope(envelope: &Value) -> Result<(), SlackError> {
    let is_ok = envelope.get("ok").and_then(Value::as_bool);
    let Some(is_ok) = is_ok else {
        return Err(SlackError::InvalidShape(
            "slack answered without the ok field every web api response carries".to_string(),
        ));
    };
    if is_ok {
        return Ok(());
    }
    let token = envelope
        .get("error")
        .and_then(Value::as_str)
        .unwrap_or("unknown_error");
    let detail = envelope_detail(envelope, token);
    match token {
        "ratelimited" | "rate_limited" => Err(SlackError::RateLimited(detail)),
        "invalid_auth"
        | "not_authed"
        | "token_revoked"
        | "token_expired"
        | "account_inactive"
        | "missing_scope"
        | "not_allowed_token_type" => Err(SlackError::Auth(format!("{detail} ({AUTH_HINT})"))),
        "channel_not_found" | "thread_not_found" | "message_not_found" | "user_not_found" => {
            Err(SlackError::NotFound(detail))
        }
        _ => Err(SlackError::Api(detail)),
    }
}

async fn send_call(token: &str, call: SlackCall) -> Result<Value, SlackError> {
    let mut request = http_client()
        .request(call.method, &call.url)
        .bearer_auth(token)
        .header("Accept", "application/json");
    if let Some(payload) = call.body {
        request = request.json(&payload);
    }
    let res = request.send().await?;
    let status = res.status().as_u16();
    let retry_after = res
        .headers()
        .get("Retry-After")
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let body = res.text().await?;
    if let Some(error) = error_for_status(status, retry_after.as_deref(), &body) {
        return Err(error);
    }
    let envelope: Value =
        serde_json::from_str(&body).map_err(|e| SlackError::InvalidShape(e.to_string()))?;
    decode_slack_envelope(&envelope)?;
    Ok(envelope)
}

struct Pager {
    seen: HashSet<String>,
    pages: u32,
}

impl Pager {
    fn new() -> Self {
        Self {
            seen: HashSet::new(),
            pages: 0,
        }
    }

    fn absorb<T: serde::de::DeserializeOwned>(
        &mut self,
        envelope: &Value,
        field: &str,
        sink: &mut Vec<T>,
    ) -> Result<Option<String>, SlackError> {
        let items = envelope
            .get(field)
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        for item in items {
            let parsed: T = serde_json::from_value(item)
                .map_err(|e| SlackError::InvalidShape(e.to_string()))?;
            sink.push(parsed);
        }
        self.pages += 1;
        if self.pages >= MAX_PAGES {
            return Ok(None);
        }
        let next = envelope
            .get("response_metadata")
            .and_then(|meta| meta.get("next_cursor"))
            .and_then(Value::as_str)
            .map(str::to_string);
        let Some(next) = next.filter(|value| !value.trim().is_empty()) else {
            return Ok(None);
        };
        if !self.seen.insert(next.clone()) {
            return Err(SlackError::InvalidShape(format!(
                "slack pagination looped on cursor {next}"
            )));
        }
        Ok(Some(next))
    }
}

async fn fetch_paged<T: serde::de::DeserializeOwned>(
    base: &str,
    token: &str,
    spec: SlackCallSpec<'_>,
) -> Result<Vec<T>, SlackError> {
    let field = collection_field(&spec);
    let mut pager = Pager::new();
    let mut collected: Vec<T> = Vec::new();
    let mut cursor: Option<String> = None;
    loop {
        let page = {
            let scoped = with_cursor_spec(&spec, cursor.as_deref());
            send_call(token, slack_call(base, &scoped)).await?
        };
        let Some(next) = pager.absorb(&page, field, &mut collected)? else {
            break;
        };
        cursor = Some(next);
    }
    Ok(collected)
}

fn read_token(workspace_id: &str, cache: &SlackTokenCache) -> Result<String, SlackError> {
    if let Some(token) = cache.0.lock().unwrap().get(workspace_id) {
        return Ok(token.clone());
    }
    let token = secrets::read(&credential_key(workspace_id))?
        .ok_or_else(|| SlackError::NoToken(workspace_id.to_string()))?;
    cache
        .0
        .lock()
        .unwrap()
        .insert(workspace_id.to_string(), token.clone());
    Ok(token)
}

pub fn iso_from_slack_ts(ts: &str) -> Option<String> {
    let seconds: i64 = ts.split('.').next()?.parse().ok()?;
    if seconds < 0 {
        return None;
    }
    let (year, month, day, hour, minute, second) = epoch_secs_to_datetime(seconds);
    Some(format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, minute, second
    ))
}

#[derive(Debug, Deserialize)]
struct SlackAuthTestRaw {
    #[serde(default)]
    team: Option<String>,
    #[serde(default)]
    team_id: Option<String>,
    #[serde(default)]
    user: Option<String>,
    #[serde(default)]
    user_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlackConnection {
    pub team_id: String,
    pub team_name: String,
    pub bot_user_id: String,
    pub bot_user_name: String,
}

fn map_connection(raw: SlackAuthTestRaw) -> SlackConnection {
    let team_id = raw.team_id.unwrap_or_default();
    let bot_user_id = raw.user_id.unwrap_or_default();
    SlackConnection {
        team_name: raw.team.clone().unwrap_or_else(|| team_id.clone()),
        team_id,
        bot_user_name: raw.user.unwrap_or_else(|| bot_user_id.clone()),
        bot_user_id,
    }
}

#[derive(Debug, Default, Deserialize)]
struct SlackTopicRaw {
    #[serde(default)]
    value: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SlackChannelRaw {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    is_member: bool,
    #[serde(default)]
    is_archived: bool,
    #[serde(default)]
    topic: Option<SlackTopicRaw>,
    #[serde(default)]
    num_members: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlackChannel {
    pub id: String,
    pub name: String,
    pub is_member: bool,
    pub topic: Option<String>,
    pub member_count: Option<u64>,
}

fn map_channel(raw: SlackChannelRaw) -> SlackChannel {
    let topic = raw
        .topic
        .unwrap_or_default()
        .value
        .filter(|value| !value.is_empty());
    SlackChannel {
        id: raw.id.unwrap_or_default(),
        name: raw.name.unwrap_or_default(),
        is_member: raw.is_member,
        topic,
        member_count: raw.num_members,
    }
}

fn keeps_channel(raw: &SlackChannelRaw) -> bool {
    raw.is_member && !raw.is_archived
}

#[derive(Debug, Deserialize)]
struct SlackReactionRaw {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    count: u64,
}

#[derive(Debug, Serialize)]
pub struct SlackReaction {
    pub name: String,
    pub count: u64,
}

#[derive(Debug, Deserialize)]
struct SlackMessageRaw {
    #[serde(default)]
    ts: Option<String>,
    #[serde(default)]
    thread_ts: Option<String>,
    #[serde(default)]
    user: Option<String>,
    #[serde(default)]
    bot_id: Option<String>,
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    subtype: Option<String>,
    #[serde(default)]
    reply_count: u64,
    #[serde(default)]
    reply_users_count: u64,
    #[serde(default)]
    latest_reply: Option<String>,
    #[serde(default)]
    reactions: Vec<SlackReactionRaw>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlackMessage {
    pub ts: String,
    pub thread_ts: Option<String>,
    pub user_id: Option<String>,
    pub bot_id: Option<String>,
    pub text: String,
    pub subtype: Option<String>,
    pub reply_count: u64,
    pub reply_user_count: u64,
    pub posted_at: Option<String>,
    pub latest_reply_at: Option<String>,
    pub reactions: Vec<SlackReaction>,
}

fn map_message(raw: SlackMessageRaw) -> SlackMessage {
    let ts = raw.ts.unwrap_or_default();
    SlackMessage {
        posted_at: iso_from_slack_ts(&ts),
        latest_reply_at: raw.latest_reply.as_deref().and_then(iso_from_slack_ts),
        ts,
        thread_ts: raw.thread_ts,
        user_id: raw.user,
        bot_id: raw.bot_id,
        text: raw.text.unwrap_or_default(),
        subtype: raw.subtype,
        reply_count: raw.reply_count,
        reply_user_count: raw.reply_users_count,
        reactions: raw
            .reactions
            .into_iter()
            .map(|reaction| SlackReaction {
                name: reaction.name.unwrap_or_default(),
                count: reaction.count,
            })
            .collect(),
    }
}

fn thread_heads(raw: Vec<SlackMessageRaw>) -> Vec<SlackMessage> {
    let mut heads: Vec<SlackMessage> = raw
        .into_iter()
        .filter(|message| message.reply_count > 0)
        .map(map_message)
        .collect();
    heads.sort_by(|left, right| right.ts.cmp(&left.ts));
    heads
}

#[derive(Debug, Default, Deserialize)]
struct SlackProfileRaw {
    #[serde(default)]
    display_name: Option<String>,
    #[serde(default)]
    real_name: Option<String>,
    #[serde(default)]
    image_48: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SlackUserRaw {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    real_name: Option<String>,
    #[serde(default)]
    is_bot: bool,
    #[serde(default)]
    deleted: bool,
    #[serde(default)]
    profile: Option<SlackProfileRaw>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlackUser {
    pub id: String,
    pub name: String,
    pub is_bot: bool,
    pub is_deleted: bool,
    pub avatar_url: Option<String>,
}

fn map_user(raw: SlackUserRaw) -> SlackUser {
    let profile = raw.profile.unwrap_or_default();
    let id = raw.id.unwrap_or_default();
    let name = profile
        .display_name
        .filter(|value| !value.is_empty())
        .or(profile.real_name.filter(|value| !value.is_empty()))
        .or(raw.real_name.filter(|value| !value.is_empty()))
        .or(raw.name.filter(|value| !value.is_empty()))
        .unwrap_or_else(|| id.clone());
    SlackUser {
        id,
        name,
        is_bot: raw.is_bot,
        is_deleted: raw.deleted,
        avatar_url: profile.image_48.filter(|value| !value.is_empty()),
    }
}

fn posted_message(envelope: &Value) -> Result<SlackMessage, SlackError> {
    let message = envelope
        .get("message")
        .cloned()
        .unwrap_or(Value::Object(serde_json::Map::new()));
    let mut raw: SlackMessageRaw =
        serde_json::from_value(message).map_err(|e| SlackError::InvalidShape(e.to_string()))?;
    if raw.ts.is_none() {
        raw.ts = envelope
            .get("ts")
            .and_then(Value::as_str)
            .map(str::to_string);
    }
    Ok(map_message(raw))
}

fn permalink_of(envelope: &Value) -> Result<String, SlackError> {
    envelope
        .get("permalink")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| {
            SlackError::InvalidShape("slack answered chat.getPermalink without a permalink".into())
        })
}

async fn validate_connection(base: &str, token: &str) -> Result<SlackConnection, SlackError> {
    let envelope = send_call(token, slack_call(base, &SlackCallSpec::AuthTest)).await?;
    let raw: SlackAuthTestRaw =
        serde_json::from_value(envelope).map_err(|e| SlackError::InvalidShape(e.to_string()))?;
    Ok(map_connection(raw))
}

async fn list_channels(base: &str, token: &str) -> Result<Vec<SlackChannel>, SlackError> {
    let raw: Vec<SlackChannelRaw> =
        fetch_paged(base, token, SlackCallSpec::Channels { cursor: None }).await?;
    Ok(raw
        .into_iter()
        .filter(keeps_channel)
        .map(map_channel)
        .collect())
}

async fn list_thread_heads(
    base: &str,
    token: &str,
    channel: &str,
) -> Result<Vec<SlackMessage>, SlackError> {
    let envelope = send_call(
        token,
        slack_call(
            base,
            &SlackCallSpec::History {
                channel,
                cursor: None,
            },
        ),
    )
    .await?;
    let raw: Vec<SlackMessageRaw> = serde_json::from_value(
        envelope
            .get("messages")
            .cloned()
            .unwrap_or(Value::Array(Vec::new())),
    )
    .map_err(|e| SlackError::InvalidShape(e.to_string()))?;
    Ok(thread_heads(raw))
}

async fn get_thread(
    base: &str,
    token: &str,
    channel: &str,
    thread_ts: &str,
) -> Result<Vec<SlackMessage>, SlackError> {
    let raw: Vec<SlackMessageRaw> = fetch_paged(
        base,
        token,
        SlackCallSpec::Replies {
            channel,
            thread_ts,
            cursor: None,
        },
    )
    .await?;
    Ok(raw.into_iter().map(map_message).collect())
}

async fn get_permalink(
    base: &str,
    token: &str,
    channel: &str,
    message_ts: &str,
) -> Result<String, SlackError> {
    let envelope = send_call(
        token,
        slack_call(
            base,
            &SlackCallSpec::Permalink {
                channel,
                message_ts,
            },
        ),
    )
    .await?;
    permalink_of(&envelope)
}

async fn list_users(base: &str, token: &str) -> Result<Vec<SlackUser>, SlackError> {
    let raw: Vec<SlackUserRaw> =
        fetch_paged(base, token, SlackCallSpec::Users { cursor: None }).await?;
    Ok(raw.into_iter().map(map_user).collect())
}

async fn post_reply(
    base: &str,
    token: &str,
    channel: &str,
    thread_ts: &str,
    text: &str,
) -> Result<SlackMessage, SlackError> {
    let envelope = send_call(
        token,
        slack_call(
            base,
            &SlackCallSpec::PostReply {
                channel,
                thread_ts,
                text,
            },
        ),
    )
    .await?;
    posted_message(&envelope)
}

async fn add_reaction(
    base: &str,
    token: &str,
    channel: &str,
    message_ts: &str,
    name: &str,
) -> Result<(), SlackError> {
    send_call(
        token,
        slack_call(
            base,
            &SlackCallSpec::AddReaction {
                channel,
                message_ts,
                name,
            },
        ),
    )
    .await?;
    Ok(())
}

#[tauri::command]
pub async fn slack_validate_connection(bot_token: String) -> Result<SlackConnection, SlackError> {
    validate_connection(API_BASE, &bot_token).await
}

#[tauri::command]
pub async fn slack_connect(
    workspace_id: String,
    bot_token: String,
    cache: State<'_, SlackTokenCache>,
) -> Result<(), SlackError> {
    secrets::set(&credential_key(&workspace_id), &bot_token)?;
    cache.0.lock().unwrap().insert(workspace_id, bot_token);
    Ok(())
}

#[tauri::command]
pub async fn slack_disconnect(
    workspace_id: String,
    cache: State<'_, SlackTokenCache>,
) -> Result<(), SlackError> {
    secrets::clear(&credential_key(&workspace_id))?;
    cache.0.lock().unwrap().remove(&workspace_id);
    Ok(())
}

#[tauri::command]
pub async fn slack_list_channels(
    workspace_id: String,
    cache: State<'_, SlackTokenCache>,
) -> Result<Vec<SlackChannel>, SlackError> {
    let token = read_token(&workspace_id, &cache)?;
    list_channels(API_BASE, &token).await
}

#[tauri::command]
pub async fn slack_list_thread_heads(
    workspace_id: String,
    channel_id: String,
    cache: State<'_, SlackTokenCache>,
) -> Result<Vec<SlackMessage>, SlackError> {
    let token = read_token(&workspace_id, &cache)?;
    list_thread_heads(API_BASE, &token, &channel_id).await
}

#[tauri::command]
pub async fn slack_get_thread(
    workspace_id: String,
    channel_id: String,
    thread_ts: String,
    cache: State<'_, SlackTokenCache>,
) -> Result<Vec<SlackMessage>, SlackError> {
    let token = read_token(&workspace_id, &cache)?;
    get_thread(API_BASE, &token, &channel_id, &thread_ts).await
}

#[tauri::command]
pub async fn slack_get_permalink(
    workspace_id: String,
    channel_id: String,
    message_ts: String,
    cache: State<'_, SlackTokenCache>,
) -> Result<String, SlackError> {
    let token = read_token(&workspace_id, &cache)?;
    get_permalink(API_BASE, &token, &channel_id, &message_ts).await
}

#[tauri::command]
pub async fn slack_list_users(
    workspace_id: String,
    cache: State<'_, SlackTokenCache>,
) -> Result<Vec<SlackUser>, SlackError> {
    let token = read_token(&workspace_id, &cache)?;
    list_users(API_BASE, &token).await
}

#[tauri::command]
pub async fn slack_post_reply(
    workspace_id: String,
    channel_id: String,
    thread_ts: String,
    text: String,
    cache: State<'_, SlackTokenCache>,
) -> Result<SlackMessage, SlackError> {
    let token = read_token(&workspace_id, &cache)?;
    post_reply(API_BASE, &token, &channel_id, &thread_ts, &text).await
}

#[tauri::command]
pub async fn slack_add_reaction(
    workspace_id: String,
    channel_id: String,
    message_ts: String,
    name: String,
    cache: State<'_, SlackTokenCache>,
) -> Result<(), SlackError> {
    let token = read_token(&workspace_id, &cache)?;
    add_reaction(API_BASE, &token, &channel_id, &message_ts, &name).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    const BASE: &str = "https://slack.com/api";

    struct MockResponse {
        status: u16,
        retry_after: Option<String>,
        body: String,
    }

    fn ok_body(body: &str) -> MockResponse {
        MockResponse {
            status: 200,
            retry_after: None,
            body: body.to_string(),
        }
    }

    #[derive(Debug, Clone)]
    struct RecordedRequest {
        method: String,
        target: String,
        authorization: Option<String>,
        body: String,
    }

    impl RecordedRequest {
        fn path(&self) -> String {
            self.target
                .split('?')
                .next()
                .unwrap_or_default()
                .to_string()
        }

        fn query(&self) -> String {
            self.target
                .split_once('?')
                .map(|(_, query)| query.to_string())
                .unwrap_or_default()
        }

        fn json(&self) -> Value {
            serde_json::from_str(&self.body).unwrap_or(Value::Null)
        }
    }

    struct MockSlack {
        base: String,
        requests: Arc<Mutex<Vec<RecordedRequest>>>,
    }

    impl MockSlack {
        async fn start(responses: Vec<MockResponse>) -> Self {
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let address = listener.local_addr().unwrap();
            let requests = Arc::new(Mutex::new(Vec::new()));
            let sink = Arc::clone(&requests);
            tokio::spawn(async move {
                for response in responses {
                    let Ok((mut stream, _)) = listener.accept().await else {
                        return;
                    };
                    let Some(request) = read_request(&mut stream).await else {
                        return;
                    };
                    sink.lock().unwrap().push(request);
                    let payload = render_response(&response);
                    let _ = stream.write_all(payload.as_bytes()).await;
                    let _ = stream.flush().await;
                    let _ = stream.shutdown().await;
                }
            });
            Self {
                base: format!("http://{address}"),
                requests,
            }
        }

        fn taken(&self) -> Vec<RecordedRequest> {
            self.requests.lock().unwrap().clone()
        }

        fn only(&self) -> RecordedRequest {
            let taken = self.taken();
            assert_eq!(taken.len(), 1, "expected exactly one request");
            taken[0].clone()
        }
    }

    fn render_response(response: &MockResponse) -> String {
        let reason = match response.status {
            200 => "OK",
            404 => "Not Found",
            429 => "Too Many Requests",
            500 => "Internal Server Error",
            _ => "Error",
        };
        let mut head = format!(
            "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n",
            response.status,
            reason,
            response.body.len()
        );
        if let Some(delay) = response.retry_after.as_deref() {
            head.push_str(&format!("Retry-After: {delay}\r\n"));
        }
        format!("{head}\r\n{}", response.body)
    }

    fn head_end(buffer: &[u8]) -> Option<usize> {
        buffer.windows(4).position(|window| window == b"\r\n\r\n")
    }

    fn content_length(head: &str) -> usize {
        head.lines()
            .find_map(|line| {
                let (name, value) = line.split_once(':')?;
                if !name.eq_ignore_ascii_case("content-length") {
                    return None;
                }
                value.trim().parse::<usize>().ok()
            })
            .unwrap_or(0)
    }

    async fn read_request(stream: &mut tokio::net::TcpStream) -> Option<RecordedRequest> {
        let mut buffer: Vec<u8> = Vec::new();
        let mut chunk = [0u8; 2048];
        loop {
            let Some(end) = head_end(&buffer) else {
                let read = stream.read(&mut chunk).await.ok()?;
                if read == 0 {
                    return None;
                }
                buffer.extend_from_slice(&chunk[..read]);
                continue;
            };
            let head = String::from_utf8_lossy(&buffer[..end]).to_string();
            let length = content_length(&head);
            if buffer.len() < end + 4 + length {
                let read = stream.read(&mut chunk).await.ok()?;
                if read == 0 {
                    return None;
                }
                buffer.extend_from_slice(&chunk[..read]);
                continue;
            }
            let body = String::from_utf8_lossy(&buffer[end + 4..end + 4 + length]).to_string();
            let mut lines = head.lines();
            let request_line = lines.next()?;
            let mut parts = request_line.split_whitespace();
            let method = parts.next()?.to_string();
            let target = parts.next()?.to_string();
            let authorization = head.lines().find_map(|line| {
                let (name, value) = line.split_once(':')?;
                if !name.eq_ignore_ascii_case("authorization") {
                    return None;
                }
                Some(value.trim().to_string())
            });
            return Some(RecordedRequest {
                method,
                target,
                authorization,
                body,
            });
        }
    }

    #[test]
    fn credential_key_is_namespaced_per_workspace() {
        assert_eq!(credential_key("ws-1"), "goodboy.workspace.ws-1.slack");
    }

    #[test]
    fn error_kind_maps_each_variant() {
        assert_eq!(
            SlackError::Http {
                status: 500,
                body: "x".into()
            }
            .kind(),
            "http"
        );
        assert_eq!(SlackError::Auth("x".into()).kind(), "auth");
        assert_eq!(SlackError::RateLimited("x".into()).kind(), "rate_limited");
        assert_eq!(SlackError::NotFound("x".into()).kind(), "not_found");
        assert_eq!(SlackError::Api("x".into()).kind(), "api");
        assert_eq!(SlackError::InvalidShape("x".into()).kind(), "shape");
        assert_eq!(SlackError::NoToken("ws".into()).kind(), "no_token");
    }

    #[test]
    fn auth_test_is_a_post_and_every_read_is_a_get() {
        assert_eq!(
            slack_call(BASE, &SlackCallSpec::AuthTest).method,
            reqwest::Method::POST
        );
        assert_eq!(
            slack_call(BASE, &SlackCallSpec::AuthTest).url,
            "https://slack.com/api/auth.test"
        );
        assert_eq!(
            slack_call(BASE, &SlackCallSpec::Channels { cursor: None }).method,
            reqwest::Method::GET
        );
        assert_eq!(
            slack_call(BASE, &SlackCallSpec::Users { cursor: None }).method,
            reqwest::Method::GET
        );
        assert_eq!(
            slack_call(
                BASE,
                &SlackCallSpec::History {
                    channel: "C1",
                    cursor: None
                }
            )
            .method,
            reqwest::Method::GET
        );
        assert_eq!(
            slack_call(
                BASE,
                &SlackCallSpec::Replies {
                    channel: "C1",
                    thread_ts: "1.2",
                    cursor: None
                }
            )
            .method,
            reqwest::Method::GET
        );
        assert_eq!(
            slack_call(
                BASE,
                &SlackCallSpec::Permalink {
                    channel: "C1",
                    message_ts: "1.2"
                }
            )
            .method,
            reqwest::Method::GET
        );
    }

    #[test]
    fn the_channel_list_asks_only_for_live_public_channels() {
        let call = slack_call(BASE, &SlackCallSpec::Channels { cursor: None });
        assert_eq!(
            call.url,
            "https://slack.com/api/conversations.list?types=public_channel&exclude_archived=true&limit=200"
        );
        assert!(call.body.is_none());
    }

    #[test]
    fn a_cursor_is_appended_and_percent_encoded_on_every_paged_read() {
        assert!(slack_call(
            BASE,
            &SlackCallSpec::Channels {
                cursor: Some("dGVhbTpDMDYrLw==")
            }
        )
        .url
        .ends_with("&cursor=dGVhbTpDMDYrLw%3D%3D"));
        assert!(
            slack_call(BASE, &SlackCallSpec::Users { cursor: Some("  ") })
                .url
                .ends_with("limit=200")
        );
    }

    #[test]
    fn the_thread_read_carries_the_channel_and_the_parent_timestamp() {
        let call = slack_call(
            BASE,
            &SlackCallSpec::Replies {
                channel: "C0EN",
                thread_ts: "1723456789.123456",
                cursor: None,
            },
        );
        assert_eq!(
            call.url,
            "https://slack.com/api/conversations.replies?channel=C0EN&ts=1723456789.123456&limit=200"
        );
    }

    #[test]
    fn the_permalink_read_uses_the_message_ts_param_name() {
        let call = slack_call(
            BASE,
            &SlackCallSpec::Permalink {
                channel: "C0EN",
                message_ts: "1723456789.123456",
            },
        );
        assert_eq!(
            call.url,
            "https://slack.com/api/chat.getPermalink?channel=C0EN&message_ts=1723456789.123456"
        );
    }

    #[test]
    fn a_reply_posts_the_parent_thread_ts_beside_the_text() {
        let call = slack_call(
            BASE,
            &SlackCallSpec::PostReply {
                channel: "C0EN",
                thread_ts: "1723456789.123456",
                text: "on it",
            },
        );
        assert_eq!(call.method, reqwest::Method::POST);
        assert_eq!(call.url, "https://slack.com/api/chat.postMessage");
        let body = call.body.expect("the reply carries a body");
        assert_eq!(body["channel"], "C0EN");
        assert_eq!(body["thread_ts"], "1723456789.123456");
        assert_eq!(body["text"], "on it");
    }

    #[test]
    fn a_reaction_posts_the_timestamp_under_its_own_param_name() {
        let call = slack_call(
            BASE,
            &SlackCallSpec::AddReaction {
                channel: "C0EN",
                message_ts: "1723456789.123456",
                name: "eyes",
            },
        );
        assert_eq!(call.method, reqwest::Method::POST);
        assert_eq!(call.url, "https://slack.com/api/reactions.add");
        let body = call.body.expect("the reaction carries a body");
        assert_eq!(body["timestamp"], "1723456789.123456");
        assert_eq!(body["name"], "eyes");
        assert!(body.get("thread_ts").is_none());
    }

    #[test]
    fn a_429_becomes_a_rate_limit_error_carrying_the_retry_after_header() {
        let error = error_for_status(429, Some("30"), r#"{"ok":false,"error":"ratelimited"}"#)
            .expect("a 429 is an error");
        let SlackError::RateLimited(detail) = error else {
            panic!("expected a rate limit error");
        };
        assert!(detail.contains("30"));
    }

    #[test]
    fn the_status_branch_covers_auth_not_found_and_everything_else() {
        assert!(matches!(
            error_for_status(401, None, "nope"),
            Some(SlackError::Auth(_))
        ));
        assert!(matches!(
            error_for_status(403, None, "nope"),
            Some(SlackError::Auth(_))
        ));
        assert!(matches!(
            error_for_status(404, None, "gone"),
            Some(SlackError::NotFound(_))
        ));
        assert!(matches!(
            error_for_status(500, None, "boom"),
            Some(SlackError::Http { status: 500, .. })
        ));
        assert!(error_for_status(200, None, "{}").is_none());
    }

    #[test]
    fn the_envelope_decoder_classifies_the_ok_false_error_tokens() {
        let auth =
            decode_slack_envelope(&serde_json::json!({"ok": false, "error": "invalid_auth"}))
                .unwrap_err();
        assert!(matches!(auth, SlackError::Auth(ref m) if m.contains("invalid_auth")));

        let scope = decode_slack_envelope(&serde_json::json!({
            "ok": false, "error": "missing_scope", "needed": "channels:history", "provided": "channels:read"
        }))
        .unwrap_err();
        assert!(
            matches!(scope, SlackError::Auth(ref m) if m.contains("missing_scope: channels:history"))
        );

        let missing =
            decode_slack_envelope(&serde_json::json!({"ok": false, "error": "channel_not_found"}))
                .unwrap_err();
        assert!(matches!(missing, SlackError::NotFound(ref m) if m == "channel_not_found"));

        let other =
            decode_slack_envelope(&serde_json::json!({"ok": false, "error": "is_archived"}))
                .unwrap_err();
        assert!(matches!(other, SlackError::Api(ref m) if m == "is_archived"));

        assert!(decode_slack_envelope(&serde_json::json!({"ok": true})).is_ok());
    }

    #[test]
    fn an_answer_without_the_ok_field_is_a_shape_error() {
        let error = decode_slack_envelope(&serde_json::json!({"channels": []})).unwrap_err();
        assert!(matches!(error, SlackError::InvalidShape(_)));
    }

    #[tokio::test]
    async fn the_connection_probe_posts_to_auth_test_with_a_bearer_token() {
        let server = MockSlack::start(vec![ok_body(
            r#"{"ok":true,"team":"Acme","team_id":"T01","user":"goodboy","user_id":"U09","bot_id":"B77"}"#,
        )])
        .await;

        let connection = validate_connection(&server.base, "xoxb-secret")
            .await
            .unwrap();

        let request = server.only();
        assert_eq!(request.method, "POST");
        assert_eq!(request.path(), "/auth.test");
        assert_eq!(request.authorization.as_deref(), Some("Bearer xoxb-secret"));
        assert_eq!(connection.team_id, "T01");
        assert_eq!(connection.team_name, "Acme");
        assert_eq!(connection.bot_user_id, "U09");
    }

    #[tokio::test]
    async fn a_429_never_reaches_the_envelope_decoder() {
        let server = MockSlack::start(vec![MockResponse {
            status: 429,
            retry_after: Some("42".into()),
            body: r#"{"ok":true,"team":"Acme","team_id":"T01","user_id":"U09"}"#.into(),
        }])
        .await;

        let error = validate_connection(&server.base, "xoxb-secret")
            .await
            .unwrap_err();

        let SlackError::RateLimited(detail) = error else {
            panic!("a 429 whose body decodes as a success must still be a rate limit error");
        };
        assert!(detail.contains("42"));
    }

    #[tokio::test]
    async fn a_429_wins_over_the_error_token_in_its_own_body() {
        let server = MockSlack::start(vec![MockResponse {
            status: 429,
            retry_after: None,
            body: r#"{"ok":false,"error":"invalid_auth"}"#.into(),
        }])
        .await;

        let error = validate_connection(&server.base, "xoxb-secret")
            .await
            .unwrap_err();

        assert!(matches!(error, SlackError::RateLimited(_)));
    }

    #[tokio::test]
    async fn a_200_with_ok_false_surfaces_slacks_own_error_token() {
        let server = MockSlack::start(vec![ok_body(
            r#"{"ok":false,"error":"missing_scope","needed":"channels:history"}"#,
        )])
        .await;

        let error = list_channels(&server.base, "xoxb-secret")
            .await
            .unwrap_err();

        assert!(matches!(error, SlackError::Auth(ref m) if m.contains("channels:history")));
    }

    #[tokio::test]
    async fn the_channel_list_gets_conversations_list_and_keeps_member_channels_only() {
        let server = MockSlack::start(vec![ok_body(
            r#"{"ok":true,"channels":[
                {"id":"C1","name":"eng-alerts","is_member":true,"num_members":12,"topic":{"value":"alerts"}},
                {"id":"C2","name":"random","is_member":false},
                {"id":"C3","name":"old","is_member":true,"is_archived":true}
            ]}"#,
        )])
        .await;

        let channels = list_channels(&server.base, "xoxb-secret").await.unwrap();

        let request = server.only();
        assert_eq!(request.method, "GET");
        assert_eq!(request.path(), "/conversations.list");
        assert!(request.query().contains("types=public_channel"));
        assert_eq!(channels.len(), 1);
        assert_eq!(channels[0].id, "C1");
        assert_eq!(channels[0].topic.as_deref(), Some("alerts"));
    }

    #[tokio::test]
    async fn the_thread_head_list_gets_history_and_keeps_only_messages_with_replies() {
        let server = MockSlack::start(vec![ok_body(
            r#"{"ok":true,"messages":[
                {"ts":"1723456700.000100","text":"no replies","reply_count":0},
                {"ts":"1723456789.123456","text":"billing webhook fails","reply_count":3,"reply_users_count":2,"latest_reply":"1723460000.000200"},
                {"ts":"1723456999.000300","text":"newest thread","reply_count":1}
            ]}"#,
        )])
        .await;

        let heads = list_thread_heads(&server.base, "xoxb-secret", "C0EN")
            .await
            .unwrap();

        let request = server.only();
        assert_eq!(request.method, "GET");
        assert_eq!(request.path(), "/conversations.history");
        assert!(request.query().contains("channel=C0EN"));
        assert_eq!(heads.len(), 2);
        assert_eq!(heads[0].ts, "1723456999.000300");
        assert_eq!(heads[1].reply_count, 3);
    }

    #[tokio::test]
    async fn the_thread_read_gets_conversations_replies_and_maps_every_timestamp() {
        let server = MockSlack::start(vec![ok_body(
            r#"{"ok":true,"messages":[
                {"ts":"1723456789.123456","thread_ts":"1723456789.123456","user":"U01","text":"billing webhook fails","reply_count":1},
                {"ts":"1723460000.000200","thread_ts":"1723456789.123456","user":"U02","text":"on it","reactions":[{"name":"eyes","count":2}]}
            ]}"#,
        )])
        .await;

        let thread = get_thread(&server.base, "xoxb-secret", "C0EN", "1723456789.123456")
            .await
            .unwrap();

        let request = server.only();
        assert_eq!(request.method, "GET");
        assert_eq!(request.path(), "/conversations.replies");
        assert!(request.query().contains("ts=1723456789.123456"));
        assert_eq!(thread.len(), 2);
        assert_eq!(thread[0].posted_at.as_deref(), Some("2024-08-12T09:59:49Z"));
        assert_eq!(thread[1].reactions[0].name, "eyes");
    }

    #[tokio::test]
    async fn the_permalink_read_returns_the_url_slack_answers_with() {
        let server = MockSlack::start(vec![ok_body(
            r#"{"ok":true,"channel":"C0EN","permalink":"https://acme.slack.com/archives/C0EN/p1723456789123456"}"#,
        )])
        .await;

        let permalink = get_permalink(&server.base, "xoxb-secret", "C0EN", "1723456789.123456")
            .await
            .unwrap();

        let request = server.only();
        assert_eq!(request.method, "GET");
        assert_eq!(request.path(), "/chat.getPermalink");
        assert!(request.query().contains("message_ts=1723456789.123456"));
        assert_eq!(
            permalink,
            "https://acme.slack.com/archives/C0EN/p1723456789123456"
        );
    }

    #[tokio::test]
    async fn the_user_list_gets_users_list_and_prefers_the_display_name() {
        let server = MockSlack::start(vec![ok_body(
            r#"{"ok":true,"members":[
                {"id":"U01","name":"amin","real_name":"Amin K","profile":{"display_name":"amin.k","image_48":"https://avatar/48.png"}},
                {"id":"U02","name":"bot","is_bot":true,"profile":{"display_name":"","real_name":"Goodboy"}}
            ]}"#,
        )])
        .await;

        let users = list_users(&server.base, "xoxb-secret").await.unwrap();

        let request = server.only();
        assert_eq!(request.method, "GET");
        assert_eq!(request.path(), "/users.list");
        assert_eq!(users[0].name, "amin.k");
        assert_eq!(
            users[0].avatar_url.as_deref(),
            Some("https://avatar/48.png")
        );
        assert_eq!(users[1].name, "Goodboy");
        assert!(users[1].is_bot);
    }

    #[tokio::test]
    async fn a_reply_posts_json_to_chat_post_message_with_a_bearer_token() {
        let server = MockSlack::start(vec![ok_body(
            r#"{"ok":true,"channel":"C0EN","ts":"1723460000.000200","message":{"ts":"1723460000.000200","thread_ts":"1723456789.123456","text":"on it","bot_id":"B77"}}"#,
        )])
        .await;

        let message = post_reply(
            &server.base,
            "xoxb-secret",
            "C0EN",
            "1723456789.123456",
            "on it",
        )
        .await
        .unwrap();

        let request = server.only();
        assert_eq!(request.method, "POST");
        assert_eq!(request.path(), "/chat.postMessage");
        assert_eq!(request.authorization.as_deref(), Some("Bearer xoxb-secret"));
        assert_eq!(request.json()["thread_ts"], "1723456789.123456");
        assert_eq!(request.json()["text"], "on it");
        assert_eq!(message.ts, "1723460000.000200");
        assert_eq!(message.bot_id.as_deref(), Some("B77"));
    }

    #[tokio::test]
    async fn a_reaction_posts_json_to_reactions_add() {
        let server = MockSlack::start(vec![ok_body(r#"{"ok":true}"#)]).await;

        add_reaction(
            &server.base,
            "xoxb-secret",
            "C0EN",
            "1723456789.123456",
            "eyes",
        )
        .await
        .unwrap();

        let request = server.only();
        assert_eq!(request.method, "POST");
        assert_eq!(request.path(), "/reactions.add");
        assert_eq!(request.json()["timestamp"], "1723456789.123456");
        assert_eq!(request.json()["name"], "eyes");
    }

    #[tokio::test]
    async fn a_refused_reaction_surfaces_the_error_token_instead_of_succeeding() {
        let server =
            MockSlack::start(vec![ok_body(r#"{"ok":false,"error":"already_reacted"}"#)]).await;

        let error = add_reaction(
            &server.base,
            "xoxb-secret",
            "C0EN",
            "1723456789.123456",
            "eyes",
        )
        .await
        .unwrap_err();

        assert!(matches!(error, SlackError::Api(ref m) if m == "already_reacted"));
    }

    #[tokio::test]
    async fn the_pager_follows_the_next_cursor_across_pages() {
        let server = MockSlack::start(vec![
            ok_body(
                r#"{"ok":true,"channels":[{"id":"C1","name":"one","is_member":true}],"response_metadata":{"next_cursor":"page-2"}}"#,
            ),
            ok_body(
                r#"{"ok":true,"channels":[{"id":"C2","name":"two","is_member":true}],"response_metadata":{"next_cursor":""}}"#,
            ),
        ])
        .await;

        let channels = list_channels(&server.base, "xoxb-secret").await.unwrap();

        let taken = server.taken();
        assert_eq!(taken.len(), 2);
        assert!(!taken[0].query().contains("cursor="));
        assert!(taken[1].query().contains("cursor=page-2"));
        assert_eq!(channels.len(), 2);
    }

    #[test]
    fn the_pager_bails_when_the_cursor_repeats() {
        let page = serde_json::json!({
            "ok": true,
            "channels": [{ "id": "C1", "name": "one", "is_member": true }],
            "response_metadata": { "next_cursor": "same" }
        });
        let mut pager = Pager::new();
        let mut sink: Vec<SlackChannelRaw> = Vec::new();
        pager.absorb(&page, "channels", &mut sink).unwrap();
        let error = pager.absorb(&page, "channels", &mut sink).unwrap_err();
        assert!(matches!(error, SlackError::InvalidShape(ref m) if m.contains("looped")));
    }

    #[test]
    fn the_pager_stops_at_the_page_cap_even_while_the_cursor_keeps_coming() {
        let mut pager = Pager::new();
        let mut sink: Vec<SlackChannelRaw> = Vec::new();
        for page in 0..MAX_PAGES {
            let envelope = serde_json::json!({
                "ok": true,
                "channels": [{ "id": format!("C{page}"), "name": "c", "is_member": true }],
                "response_metadata": { "next_cursor": format!("cursor-{page}") }
            });
            let outcome = pager.absorb(&envelope, "channels", &mut sink).unwrap();
            if page + 1 == MAX_PAGES {
                assert!(outcome.is_none());
            }
        }
        assert_eq!(sink.len() as u32, MAX_PAGES);
    }

    #[test]
    fn the_pager_treats_a_blank_cursor_as_the_end() {
        let envelope = serde_json::json!({
            "ok": true,
            "channels": [],
            "response_metadata": { "next_cursor": "   " }
        });
        let mut pager = Pager::new();
        let mut sink: Vec<SlackChannelRaw> = Vec::new();
        assert!(pager
            .absorb(&envelope, "channels", &mut sink)
            .unwrap()
            .is_none());
    }

    #[test]
    fn an_epoch_timestamp_maps_to_an_utc_iso_instant() {
        assert_eq!(
            iso_from_slack_ts("1723456789.123456").as_deref(),
            Some("2024-08-12T09:59:49Z")
        );
        assert_eq!(
            iso_from_slack_ts("0.000000").as_deref(),
            Some("1970-01-01T00:00:00Z")
        );
        assert!(iso_from_slack_ts("not-a-timestamp").is_none());
        assert!(iso_from_slack_ts("-1.0").is_none());
    }

    #[test]
    fn a_message_without_a_timestamp_carries_no_instant() {
        let raw: SlackMessageRaw = serde_json::from_str(r#"{"text":"hi"}"#).unwrap();
        let message = map_message(raw);
        assert_eq!(message.ts, "");
        assert!(message.posted_at.is_none());
        assert!(message.reactions.is_empty());
    }

    #[test]
    fn the_membership_filter_rejects_non_member_and_archived_channels() {
        let member: SlackChannelRaw =
            serde_json::from_str(r#"{"id":"C1","name":"a","is_member":true}"#).unwrap();
        let guest: SlackChannelRaw =
            serde_json::from_str(r#"{"id":"C2","name":"b","is_member":false}"#).unwrap();
        let archived: SlackChannelRaw =
            serde_json::from_str(r#"{"id":"C3","name":"c","is_member":true,"is_archived":true}"#)
                .unwrap();
        assert!(keeps_channel(&member));
        assert!(!keeps_channel(&guest));
        assert!(!keeps_channel(&archived));
    }

    #[test]
    fn a_posted_message_falls_back_to_the_envelope_timestamp() {
        let envelope = serde_json::json!({
            "ok": true,
            "ts": "1723460000.000200",
            "message": { "text": "on it", "thread_ts": "1723456789.123456" }
        });
        let message = posted_message(&envelope).unwrap();
        assert_eq!(message.ts, "1723460000.000200");
        assert_eq!(message.thread_ts.as_deref(), Some("1723456789.123456"));
    }

    #[test]
    fn a_permalink_answer_without_the_field_is_a_shape_error() {
        let error = permalink_of(&serde_json::json!({ "ok": true })).unwrap_err();
        assert!(matches!(error, SlackError::InvalidShape(_)));
    }
}
