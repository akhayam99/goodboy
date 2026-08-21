mod cli;
mod dispatch;
pub mod protocol;

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

use protocol::{
    QueryRequest, QueryResponse, BIN_ENV, SOCKET_ENV, SOCKET_PREFIX, SOCKET_SUFFIX, WORKSPACE_ENV,
};

pub(crate) use cli::dispatch as run_cli;

const APP_DIR: &str = ".goodboy";

static SOCKET_PATH: OnceLock<Option<PathBuf>> = OnceLock::new();
static EXE_PATH: OnceLock<Option<PathBuf>> = OnceLock::new();
static LISTENING: AtomicBool = AtomicBool::new(false);

fn socket_file_name(pid: u32) -> String {
    format!("{}{}{}", SOCKET_PREFIX, pid, SOCKET_SUFFIX)
}

fn socket_pid(file_name: &str) -> Option<u32> {
    file_name
        .strip_prefix(SOCKET_PREFIX)?
        .strip_suffix(SOCKET_SUFFIX)?
        .parse::<u32>()
        .ok()
}

fn socket_path() -> Option<&'static Path> {
    SOCKET_PATH
        .get_or_init(|| {
            dirs::home_dir().map(|home| {
                home.join(APP_DIR)
                    .join(socket_file_name(std::process::id()))
            })
        })
        .as_deref()
}

fn abandoned_sockets<'a>(
    file_names: impl Iterator<Item = &'a str>,
    is_alive: &dyn Fn(u32) -> bool,
) -> Vec<String> {
    file_names
        .filter(|name| socket_pid(name).is_some_and(|pid| !is_alive(pid)))
        .map(str::to_string)
        .collect()
}

fn exe_path() -> Option<&'static Path> {
    EXE_PATH
        .get_or_init(|| std::env::current_exe().ok())
        .as_deref()
}

fn serving(is_listening: bool, socket: Option<&Path>) -> bool {
    is_listening && socket.map(Path::exists).unwrap_or(false)
}

pub(crate) fn is_serving() -> bool {
    serving(LISTENING.load(Ordering::SeqCst), socket_path())
}

#[tauri::command]
pub fn query_bridge_serving() -> bool {
    is_serving()
}

pub(crate) fn apply_env(command: &mut Command, workspace_id: Option<&str>) {
    if !is_serving() {
        return;
    }
    let Some(socket) = socket_path() else {
        return;
    };
    command.env(SOCKET_ENV, socket);
    if let Some(workspace_id) = workspace_id {
        command.env(WORKSPACE_ENV, workspace_id);
    }
    if let Some(exe) = exe_path() {
        command.env(BIN_ENV, exe);
    }
}

#[cfg(unix)]
fn is_pid_alive(pid: u32) -> bool {
    if pid == 0 {
        return true;
    }
    let outcome = unsafe { libc::kill(pid as libc::pid_t, 0) };
    if outcome == 0 {
        return true;
    }
    std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
}

#[cfg(unix)]
fn has_listener(path: &Path) -> bool {
    std::os::unix::net::UnixStream::connect(path).is_ok()
}

#[cfg(unix)]
fn sweep_legacy_socket(path: &Path) {
    if !path.exists() {
        return;
    }
    if has_listener(path) {
        return;
    }
    let _ = std::fs::remove_file(path);
}

#[cfg(unix)]
fn sweep_abandoned_sockets(dir: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let file_names: Vec<String> = entries
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| entry.file_name().into_string().ok())
        .collect();
    for name in abandoned_sockets(file_names.iter().map(String::as_str), &is_pid_alive) {
        let _ = std::fs::remove_file(dir.join(name));
    }
    sweep_legacy_socket(&dir.join(protocol::LEGACY_SOCKET_FILE));
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
        sweep_abandoned_sockets(parent);
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
        LISTENING.store(true, Ordering::SeqCst);
        loop {
            let Ok((stream, _)) = listener.accept().await else {
                break;
            };
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                serve_connection(stream, app).await;
            });
        }
        LISTENING.store(false, Ordering::SeqCst);
    });
}

#[cfg(not(unix))]
pub(crate) fn start(_app: tauri::AppHandle) {}

pub(crate) fn shutdown() {
    LISTENING.store(false, Ordering::SeqCst);
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

        assert!(path.ends_with(format!(
            "{}/{}",
            APP_DIR,
            socket_file_name(std::process::id())
        )));
    }

    #[test]
    fn every_running_instance_binds_a_socket_named_after_its_own_pid() {
        let path = socket_path().expect("a home directory");
        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .expect("a file name");

        assert_eq!(socket_pid(name), Some(std::process::id()));
        assert_ne!(socket_file_name(1), socket_file_name(2));
    }

    #[test]
    fn only_a_pid_suffixed_socket_answers_for_an_owner() {
        assert_eq!(socket_pid("query-4321.sock"), Some(4321));
        assert_eq!(socket_pid(protocol::LEGACY_SOCKET_FILE), None);
        assert_eq!(socket_pid("query-.sock"), None);
        assert_eq!(socket_pid("query-abc.sock"), None);
        assert_eq!(socket_pid("query-12.sock.bak"), None);
        assert_eq!(socket_pid("data.db"), None);
    }

    #[test]
    fn the_sweep_takes_the_dead_and_spares_every_live_instance() {
        let names = [
            "query-11.sock",
            "query-22.sock",
            "query-33.sock",
            "query.sock",
            "data.db",
        ];
        let alive = |pid: u32| pid == 22;

        let taken = abandoned_sockets(names.into_iter(), &alive);

        assert_eq!(taken, vec!["query-11.sock", "query-33.sock"]);
    }

    #[cfg(unix)]
    fn scratch_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("goodboy-query-bridge-{}", name));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("a scratch directory");
        dir
    }

    #[cfg(unix)]
    #[test]
    fn the_process_running_the_sweep_is_alive_and_a_free_pid_is_not() {
        assert!(is_pid_alive(std::process::id()));
        assert!(!is_pid_alive(0x7fff_fffe));
    }

    #[cfg(unix)]
    #[test]
    fn a_legacy_socket_survives_only_while_a_listener_answers_on_it() {
        let dir = scratch_dir("legacy");
        let path = dir.join(protocol::LEGACY_SOCKET_FILE);
        let listener = std::os::unix::net::UnixListener::bind(&path).expect("a legacy listener");

        sweep_legacy_socket(&path);
        assert!(path.exists());

        drop(listener);
        sweep_legacy_socket(&path);
        assert!(!path.exists());

        sweep_legacy_socket(&path);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn a_crash_leftover_goes_and_this_instance_keeps_its_own_socket() {
        let dir = scratch_dir("sweep");
        let mine = dir.join(socket_file_name(std::process::id()));
        let leftover = dir.join(socket_file_name(0x7fff_fffe));
        let legacy = dir.join(protocol::LEGACY_SOCKET_FILE);
        let unrelated = dir.join("data.db");
        for path in [&mine, &leftover, &legacy, &unrelated] {
            std::fs::write(path, b"").expect("a probe file");
        }

        sweep_abandoned_sockets(&dir);

        assert!(mine.exists());
        assert!(!leftover.exists());
        assert!(!legacy.exists());
        assert!(unrelated.exists());

        let _ = std::fs::remove_dir_all(&dir);
    }

    fn injected_names(workspace_id: Option<&str>) -> Vec<String> {
        let mut command = Command::new("true");
        apply_env(&mut command, workspace_id);
        command
            .get_envs()
            .filter_map(|(key, _)| key.to_str().map(str::to_string))
            .collect()
    }

    #[test]
    fn a_child_is_told_about_the_bridge_only_while_it_is_serving() {
        let names = injected_names(Some("ws-1"));

        assert_eq!(names.contains(&SOCKET_ENV.to_string()), is_serving());
        assert_eq!(names.contains(&BIN_ENV.to_string()), is_serving());
        assert_eq!(names.contains(&WORKSPACE_ENV.to_string()), is_serving());
    }

    #[test]
    fn the_socket_a_child_is_handed_is_the_one_this_instance_binds() {
        let mut command = Command::new("true");
        apply_env(&mut command, Some("ws-1"));
        let injected = command
            .get_envs()
            .find(|(key, _)| *key == std::ffi::OsStr::new(SOCKET_ENV))
            .and_then(|(_, value)| value);

        assert_eq!(
            injected,
            is_serving().then(|| socket_path().expect("a home directory").as_os_str())
        );
    }

    #[test]
    fn the_advertisement_and_the_injection_answer_to_one_predicate() {
        let advertised = query_bridge_serving();

        assert_eq!(advertised, is_serving());
        assert_eq!(injected_names(Some("ws-1")).is_empty(), !advertised);
    }

    #[test]
    fn a_socket_file_no_listener_owns_serves_nobody() {
        assert!(!LISTENING.load(Ordering::SeqCst));

        assert!(!is_serving());
        assert!(!query_bridge_serving());
        assert!(injected_names(Some("ws-1")).is_empty());
    }

    #[test]
    fn serving_needs_a_live_listener_and_the_socket_file_it_bound() {
        let file = std::env::temp_dir().join("goodboy-query-bridge-serving.probe");
        std::fs::write(&file, b"").expect("a probe file");
        let missing = std::env::temp_dir().join("goodboy-query-bridge-serving.absent");
        let _ = std::fs::remove_file(&missing);

        assert!(serving(true, Some(&file)));
        assert!(!serving(false, Some(&file)));
        assert!(!serving(true, Some(&missing)));
        assert!(!serving(true, None));

        let _ = std::fs::remove_file(&file);
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
