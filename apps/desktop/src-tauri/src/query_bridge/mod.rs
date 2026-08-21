mod cli;
mod dispatch;
pub mod protocol;

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

use protocol::{QueryRequest, QueryResponse, BIN_ENV, SOCKET_ENV, SOCKET_FILE, WORKSPACE_ENV};

pub(crate) use cli::dispatch as run_cli;

const APP_DIR: &str = ".goodboy";

static SOCKET_PATH: OnceLock<Option<PathBuf>> = OnceLock::new();
static EXE_PATH: OnceLock<Option<PathBuf>> = OnceLock::new();

fn socket_path() -> Option<&'static Path> {
    SOCKET_PATH
        .get_or_init(|| dirs::home_dir().map(|home| home.join(APP_DIR).join(SOCKET_FILE)))
        .as_deref()
}

fn exe_path() -> Option<&'static Path> {
    EXE_PATH
        .get_or_init(|| std::env::current_exe().ok())
        .as_deref()
}

pub(crate) fn apply_env(command: &mut Command, workspace_id: Option<&str>) {
    let Some(socket) = socket_path() else {
        return;
    };
    if !socket.exists() {
        return;
    }
    command.env(SOCKET_ENV, socket);
    if let Some(workspace_id) = workspace_id {
        command.env(WORKSPACE_ENV, workspace_id);
    }
    if let Some(exe) = exe_path() {
        command.env(BIN_ENV, exe);
    }
}

#[cfg(unix)]
pub(crate) fn start(app: tauri::AppHandle) {
    use std::os::unix::fs::PermissionsExt;
    use tokio::net::UnixListener;

    let Some(path) = socket_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        if let Err(error) = std::fs::create_dir_all(parent) {
            log::warn!("query bridge: state directory unavailable: {error}");
            return;
        }
    }
    let _ = std::fs::remove_file(path);
    tauri::async_runtime::spawn(async move {
        let Some(path) = socket_path() else {
            return;
        };
        let listener = match UnixListener::bind(path) {
            Ok(listener) => listener,
            Err(error) => {
                log::warn!("query bridge: socket unavailable: {error}");
                return;
            }
        };
        if let Err(error) = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600)) {
            log::warn!("query bridge: socket permissions not narrowed: {error}");
            let _ = std::fs::remove_file(path);
            return;
        }
        loop {
            let Ok((stream, _)) = listener.accept().await else {
                break;
            };
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                serve_connection(stream, app).await;
            });
        }
    });
}

#[cfg(not(unix))]
pub(crate) fn start(_app: tauri::AppHandle) {}

pub(crate) fn shutdown() {
    if let Some(path) = socket_path() {
        let _ = std::fs::remove_file(path);
    }
}

#[cfg(unix)]
async fn serve_connection(stream: tokio::net::UnixStream, app: tauri::AppHandle) {
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

    let (reader, mut writer) = stream.into_split();
    let mut lines = BufReader::new(reader).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }
        let response = answer(&app, &line).await;
        let mut payload = match serde_json::to_string(&response) {
            Ok(payload) => payload,
            Err(error) => format!("{{\"ok\":false,\"error\":\"{}\"}}", error),
        };
        payload.push('\n');
        if writer.write_all(payload.as_bytes()).await.is_err() {
            break;
        }
    }
}

async fn answer(app: &tauri::AppHandle, line: &str) -> QueryResponse {
    let request = match serde_json::from_str::<QueryRequest>(line) {
        Ok(request) => request,
        Err(error) => return QueryResponse::failed(format!("malformed request: {}", error)),
    };
    match dispatch::dispatch(app, &request).await {
        Ok(data) => QueryResponse::ok(data),
        Err(error) => QueryResponse::failed(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_socket_lives_beside_the_database_in_the_state_directory() {
        let path = socket_path().expect("a home directory");

        assert!(path.ends_with(format!("{}/{}", APP_DIR, SOCKET_FILE)));
    }

    #[test]
    fn a_child_is_told_about_the_bridge_only_while_the_socket_is_live() {
        let mut command = Command::new("true");

        apply_env(&mut command, Some("ws-1"));

        let names: Vec<String> = command
            .get_envs()
            .filter_map(|(key, _)| key.to_str().map(str::to_string))
            .collect();
        let live = socket_path().map(Path::exists).unwrap_or(false);
        assert_eq!(names.contains(&SOCKET_ENV.to_string()), live);
        assert_eq!(names.contains(&BIN_ENV.to_string()), live);
    }

    #[test]
    fn the_advertised_binary_is_the_running_executable_by_absolute_path() {
        let exe = exe_path().expect("a current executable");

        assert!(exe.is_absolute(), "{}", exe.display());
        assert_eq!(exe, std::env::current_exe().expect("a current executable"));
    }

    #[test]
    fn a_malformed_request_is_answered_rather_than_dropped() {
        let response = QueryResponse::failed("malformed request: expected value");

        assert!(!response.ok);
        assert!(response.data.is_none());
        assert!(response
            .error
            .expect("an error")
            .contains("malformed request"));
    }
}
