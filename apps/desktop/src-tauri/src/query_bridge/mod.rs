mod args;
mod cli;
mod dispatch;
mod github;
pub mod mount;
pub mod project;
pub mod protocol;
mod series;

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

use protocol::{
    QueryRequest, QueryResponse, BIN_ENV, MOUNT_ENV, RUN_ENV, SESSION_ENV, SOCKET_ENV,
    SOCKET_PREFIX, SOCKET_SUFFIX, WORKSPACE_ENV,
};

pub(crate) use cli::dispatch as run_cli;

const APP_DIR: &str = ".goodboy";
const SOCKET_DIR: &str = "sockets";
const SWEEP_SUFFIX: &str = ".sweep-";
const MAX_SOCKET_PATH_BYTES: usize = 103;

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

fn socket_directory_in(app_dir: &Path) -> PathBuf {
    app_dir.join(SOCKET_DIR)
}

fn socket_path_in(home: &Path, pid: u32) -> PathBuf {
    socket_directory_in(&home.join(APP_DIR)).join(socket_file_name(pid))
}

fn fits_socket_address(path: &Path) -> bool {
    path.as_os_str().len() <= MAX_SOCKET_PATH_BYTES
}

fn socket_path() -> Option<&'static Path> {
    SOCKET_PATH
        .get_or_init(|| dirs::home_dir().map(|home| socket_path_in(&home, std::process::id())))
        .as_deref()
}

pub(crate) fn socket_directory() -> Option<&'static Path> {
    socket_path()?.parent()
}

fn previous_socket_directory() -> Option<&'static Path> {
    socket_directory()?.parent()
}

fn abandoned_sockets<'a>(
    file_names: impl Iterator<Item = &'a str>,
    is_alive: &dyn Fn(u32) -> bool,
) -> Vec<(String, u32)> {
    file_names
        .filter_map(|name| socket_pid(name).map(|pid| (name.to_string(), pid)))
        .filter(|(_, pid)| !is_alive(*pid))
        .collect()
}

fn sweeper_pid(file_name: &str) -> Option<u32> {
    file_name.rsplit_once(SWEEP_SUFFIX)?.1.parse::<u32>().ok()
}

fn abandoned_staged_files<'a>(
    file_names: impl Iterator<Item = &'a str>,
    is_alive: &dyn Fn(u32) -> bool,
) -> Vec<String> {
    file_names
        .filter(|name| sweeper_pid(name).is_some_and(|pid| !is_alive(pid)))
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

pub(crate) struct TurnBinding<'a> {
    pub(crate) workspace_id: Option<&'a str>,
    pub(crate) session_id: Option<&'a str>,
    pub(crate) mount_id: Option<&'a str>,
    pub(crate) run_id: Option<&'a str>,
}

pub(crate) fn apply_env(
    command: &mut Command,
    workspace_id: Option<&str>,
    session_id: Option<&str>,
) {
    apply_turn_env(
        command,
        TurnBinding {
            workspace_id,
            session_id,
            mount_id: None,
            run_id: None,
        },
    );
}

pub(crate) fn apply_turn_env(command: &mut Command, binding: TurnBinding<'_>) {
    if !is_serving() {
        return;
    }
    let Some(socket) = socket_path() else {
        return;
    };
    command.env(SOCKET_ENV, socket);
    if let Some(workspace_id) = binding.workspace_id {
        command.env(WORKSPACE_ENV, workspace_id);
    }
    if let Some(session_id) = binding.session_id {
        command.env(SESSION_ENV, session_id);
    }
    if let Some(mount_id) = binding.mount_id {
        command.env(MOUNT_ENV, mount_id);
    }
    if let Some(run_id) = binding.run_id {
        command.env(RUN_ENV, run_id);
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
fn staged_name(path: &Path) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(format!("{}{}", SWEEP_SUFFIX, std::process::id()));
    PathBuf::from(name)
}

#[cfg(unix)]
fn restore_staged(staged: &Path, path: &Path) {
    if std::fs::hard_link(staged, path).is_err() {
        return;
    }
    let _ = std::fs::remove_file(staged);
}

#[cfg(unix)]
fn discard_unless_owned(path: &Path, is_owned: &dyn Fn(&Path) -> bool) {
    let staged = staged_name(path);
    if std::fs::rename(path, &staged).is_err() {
        return;
    }
    if is_owned(&staged) {
        restore_staged(&staged, path);
        return;
    }
    let _ = std::fs::remove_file(&staged);
}

#[cfg(unix)]
fn is_socket_file(path: &Path) -> bool {
    use std::os::unix::fs::FileTypeExt;

    std::fs::symlink_metadata(path).is_ok_and(|metadata| metadata.file_type().is_socket())
}

#[cfg(unix)]
fn socket_file_names(dir: &Path) -> Vec<String> {
    use std::os::unix::fs::FileTypeExt;

    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry
                .file_type()
                .is_ok_and(|file_type| file_type.is_socket())
        })
        .filter_map(|entry| entry.file_name().into_string().ok())
        .collect()
}

#[cfg(unix)]
fn sweep_abandoned_sockets(dir: &Path) {
    let file_names = socket_file_names(dir);
    for (name, pid) in abandoned_sockets(file_names.iter().map(String::as_str), &is_pid_alive) {
        discard_unless_owned(&dir.join(name), &|_| is_pid_alive(pid));
    }
    for name in abandoned_staged_files(file_names.iter().map(String::as_str), &is_pid_alive) {
        let _ = std::fs::remove_file(dir.join(name));
    }
    let legacy = dir.join(protocol::LEGACY_SOCKET_FILE);
    if is_socket_file(&legacy) {
        discard_unless_owned(&legacy, &has_listener);
    }
}

#[cfg(unix)]
fn prepare_socket_directory(dir: &Path) -> std::io::Result<()> {
    use std::os::unix::fs::{DirBuilderExt, MetadataExt, PermissionsExt};

    if let Some(parent) = dir.parent() {
        std::fs::create_dir_all(parent)?;
    }
    match std::fs::DirBuilder::new().mode(0o700).create(dir) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
        Err(error) => return Err(error),
    }
    let metadata = std::fs::symlink_metadata(dir)?;
    if !metadata.file_type().is_dir() {
        return Err(std::io::Error::other(format!(
            "{} is not a plain directory",
            dir.display()
        )));
    }
    if metadata.uid() != unsafe { libc::geteuid() } {
        return Err(std::io::Error::other(format!(
            "{} belongs to another user",
            dir.display()
        )));
    }
    std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o700))
}

#[cfg(unix)]
pub(crate) fn start(app: tauri::AppHandle) {
    use std::os::unix::fs::PermissionsExt;
    use tokio::net::UnixListener;

    let Some(path) = socket_path() else {
        return;
    };
    let Some(dir) = socket_directory() else {
        return;
    };
    if !fits_socket_address(path) {
        log::warn!(
            "query bridge: socket path exceeds {MAX_SOCKET_PATH_BYTES} bytes: {}",
            path.display()
        );
        return;
    }
    if let Err(error) = prepare_socket_directory(dir) {
        log::warn!("query bridge: socket directory unavailable: {error}");
        return;
    }
    sweep_abandoned_sockets(dir);
    if let Some(previous) = previous_socket_directory() {
        sweep_abandoned_sockets(previous);
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
    serve_lines(stream, move |line| {
        let app = app.clone();
        async move { answer(&app, &line).await }
    })
    .await;
}

#[cfg(unix)]
async fn serve_lines<Respond, Answer>(stream: tokio::net::UnixStream, respond: Respond)
where
    Respond: Fn(String) -> Answer,
    Answer: std::future::Future<Output = QueryResponse>,
{
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

    let (reader, mut writer) = stream.into_split();
    let mut lines = BufReader::new(reader).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }
        let response = respond(line).await;
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
        Err(error) => QueryResponse::refused(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_socket_lives_in_a_directory_of_its_own_under_the_state_directory() {
        let path = socket_path().expect("a home directory");

        assert!(path.ends_with(format!(
            "{}/{}/{}",
            APP_DIR,
            SOCKET_DIR,
            socket_file_name(std::process::id())
        )));
        assert_eq!(path.parent(), socket_directory());
        assert_eq!(
            socket_directory().and_then(Path::parent),
            previous_socket_directory()
        );
    }

    #[test]
    fn the_granted_directory_holds_no_database_sidecar_or_snapshot() {
        let granted = socket_directory().expect("a home directory");
        let state = previous_socket_directory().expect("a home directory");

        assert_ne!(granted, state);
        assert!(!state.starts_with(granted));
        for name in [
            "data.db",
            "data.db-wal",
            "data.db-shm",
            "data.dev.db",
            "data.dev.db-wal",
            "data.dev.db-shm",
            "data.db.pre-m161-from-m160-20260919T143758961Z.bak",
        ] {
            assert!(!state.join(name).starts_with(granted), "{name}");
        }
        let database = crate::db::resolve_db_path().expect("a database path");
        assert!(!database.starts_with(granted), "{}", database.display());
    }

    #[test]
    fn a_socket_path_the_platform_cannot_address_is_refused_before_binding() {
        let own = socket_path().expect("a home directory");
        let long_user = Path::new("/Users/abcdefghijklmnopqrstuvwxyzabcdef");
        let widest = socket_path_in(long_user, u32::MAX);
        let too_deep = Path::new("/Users/n").join("a".repeat(MAX_SOCKET_PATH_BYTES));

        assert!(fits_socket_address(own), "{}", own.display());
        assert!(fits_socket_address(&widest), "{}", widest.display());
        assert!(!fits_socket_address(&socket_path_in(&too_deep, 1)));
        assert!(fits_socket_address(Path::new(
            &"a".repeat(MAX_SOCKET_PATH_BYTES)
        )));
        assert!(!fits_socket_address(Path::new(
            &"a".repeat(MAX_SOCKET_PATH_BYTES + 1)
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

        assert_eq!(
            taken,
            vec![
                ("query-11.sock".to_string(), 11),
                ("query-33.sock".to_string(), 33)
            ]
        );
    }

    #[test]
    fn a_staged_file_belongs_to_the_sweeper_named_in_it() {
        assert_eq!(sweeper_pid("query-9.sock.sweep-4321"), Some(4321));
        assert_eq!(sweeper_pid("query.sock.sweep-7"), Some(7));
        assert_eq!(sweeper_pid("query-9.sock"), None);
        assert_eq!(sweeper_pid("query-9.sock.sweep-"), None);
        assert_eq!(sweeper_pid("query-9.sock.sweep-abc"), None);
        assert_eq!(sweeper_pid("data.db"), None);
    }

    #[test]
    fn a_sweeper_that_died_mid_operation_leaves_nothing_behind() {
        let names = [
            "query-9.sock.sweep-11",
            "query-9.sock.sweep-22",
            "query.sock.sweep-33",
            "query-9.sock",
            "data.db",
        ];
        let alive = |pid: u32| pid == 22;

        let taken = abandoned_staged_files(names.into_iter(), &alive);

        assert_eq!(taken, vec!["query-9.sock.sweep-11", "query.sock.sweep-33"]);
    }

    #[cfg(unix)]
    fn scratch_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("goodboy-query-bridge-{}", name));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("a scratch directory");
        dir
    }

    #[cfg(unix)]
    fn socket_file(path: &Path) {
        let bound = path.parent().expect("a parent directory").join("b");
        let _ = std::fs::remove_file(&bound);
        drop(std::os::unix::net::UnixListener::bind(&bound).expect("a socket file"));
        std::fs::rename(&bound, path).expect("a socket file in place");
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

        sweep_abandoned_sockets(&dir);

        assert!(path.exists());
        assert!(has_listener(&path));
        assert_eq!(staged_leftovers(&dir), Vec::<String>::new());

        drop(listener);
        sweep_abandoned_sockets(&dir);

        assert!(!path.exists());
        assert_eq!(staged_leftovers(&dir), Vec::<String>::new());

        sweep_abandoned_sockets(&dir);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    fn staged_leftovers(dir: &Path) -> Vec<String> {
        let mut names: Vec<String> = std::fs::read_dir(dir)
            .expect("a readable directory")
            .filter_map(|entry| entry.ok())
            .filter_map(|entry| entry.file_name().into_string().ok())
            .filter(|name| name.contains(SWEEP_SUFFIX))
            .collect();
        names.sort();
        names
    }

    #[cfg(unix)]
    #[test]
    fn a_socket_taken_out_of_the_way_goes_back_when_its_owner_still_answers() {
        let dir = scratch_dir("restore");
        let path = dir.join(socket_file_name(std::process::id()));
        std::fs::write(&path, b"").expect("a probe file");

        discard_unless_owned(&path, &|_| true);

        assert!(path.exists());
        assert_eq!(staged_leftovers(&dir), Vec::<String>::new());

        discard_unless_owned(&path, &|_| false);

        assert!(!path.exists());
        assert_eq!(staged_leftovers(&dir), Vec::<String>::new());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn a_restore_puts_the_very_same_file_back_under_its_own_name() {
        let dir = scratch_dir("restore-back");
        let path = dir.join(socket_file_name(std::process::id()));
        std::fs::write(&path, b"owner").expect("a probe file");
        let staged = staged_name(&path);
        std::fs::rename(&path, &staged).expect("a staged file");

        restore_staged(&staged, &path);

        assert_eq!(std::fs::read_to_string(&path).expect("the file"), "owner");
        assert!(!staged.exists());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn a_restore_never_lands_on_a_name_another_process_took_meanwhile() {
        let dir = scratch_dir("restore-taken");
        let path = dir.join(socket_file_name(std::process::id()));
        std::fs::write(&path, b"owner").expect("a probe file");
        let staged = staged_name(&path);
        std::fs::rename(&path, &staged).expect("a staged file");
        std::fs::write(&path, b"newcomer").expect("a newcomer file");

        restore_staged(&staged, &path);

        assert_eq!(
            std::fs::read_to_string(&path).expect("the file"),
            "newcomer"
        );
        assert!(staged.exists());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn a_staged_file_outlives_its_sweeper_only_while_that_sweeper_runs() {
        let dir = scratch_dir("staged");
        let mine = dir.join(format!(
            "{}{}{}",
            socket_file_name(7),
            SWEEP_SUFFIX,
            std::process::id()
        ));
        let orphan = dir.join(format!(
            "{}{}{}",
            socket_file_name(7),
            SWEEP_SUFFIX,
            0x7fff_fffe_u32
        ));
        for path in [&mine, &orphan] {
            socket_file(path);
        }

        sweep_abandoned_sockets(&dir);

        assert!(mine.exists());
        assert!(!orphan.exists());

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
        for path in [&mine, &leftover, &legacy] {
            socket_file(path);
        }
        std::fs::write(&unrelated, b"").expect("a probe file");

        sweep_abandoned_sockets(&dir);

        assert!(mine.exists());
        assert!(!leftover.exists());
        assert!(!legacy.exists());
        assert!(unrelated.exists());
        assert_eq!(staged_leftovers(&dir), Vec::<String>::new());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    fn state_directory_fixture(name: &str) -> (PathBuf, PathBuf) {
        let state = scratch_dir(name);
        let sockets = socket_directory_in(&state);
        prepare_socket_directory(&sockets).expect("a socket directory");
        (state, sockets)
    }

    #[cfg(unix)]
    #[test]
    fn the_socket_directory_is_private_and_never_a_link_to_somewhere_else() {
        use std::os::unix::fs::PermissionsExt;

        let (state, sockets) = state_directory_fixture("private");
        let mode = std::fs::metadata(&sockets)
            .expect("a socket directory")
            .permissions()
            .mode();

        assert_eq!(mode & 0o777, 0o700);
        assert!(prepare_socket_directory(&sockets).is_ok());

        std::fs::remove_dir(&sockets).expect("an empty socket directory");
        std::os::unix::fs::symlink(&state, &sockets).expect("a planted link");

        assert!(prepare_socket_directory(&sockets).is_err());

        let _ = std::fs::remove_dir_all(&state);
    }

    #[cfg(unix)]
    #[test]
    fn two_live_instances_both_survive_a_sweep() {
        let (state, sockets) = state_directory_fixture("live");
        let own = sockets.join(socket_file_name(std::process::id()));
        let other = sockets.join(socket_file_name(std::os::unix::process::parent_id()));
        let dead = sockets.join(socket_file_name(0x7fff_fffe));
        let own_listener = std::os::unix::net::UnixListener::bind(&own).expect("a listener");
        let other_listener = std::os::unix::net::UnixListener::bind(&other).expect("a listener");
        socket_file(&dead);

        sweep_abandoned_sockets(&sockets);

        assert!(has_listener(&own));
        assert!(has_listener(&other));
        assert!(!dead.exists());
        assert_eq!(staged_leftovers(&sockets), Vec::<String>::new());

        drop((own_listener, other_listener));
        let _ = std::fs::remove_dir_all(&state);
    }

    #[cfg(unix)]
    #[test]
    fn the_sweep_cannot_touch_the_database_its_sidecars_or_its_snapshots() {
        let (state, sockets) = state_directory_fixture("guard");
        let dead = 0x7fff_fffe_u32;
        let stored = [
            "data.db",
            "data.db-wal",
            "data.db-shm",
            "data.dev.db",
            "data.db.pre-m161-from-m160-20260919T143758961Z.bak",
        ];
        for name in stored {
            std::fs::write(state.join(name), name).expect("a state file");
        }
        let impostors = [
            socket_file_name(dead),
            protocol::LEGACY_SOCKET_FILE.to_string(),
            format!("{}{}{}", socket_file_name(9), SWEEP_SUFFIX, dead),
        ];
        for name in &impostors {
            std::fs::write(state.join(name), name).expect("an impostor file");
        }
        let links = [
            (socket_file_name(dead), "data.db"),
            (protocol::LEGACY_SOCKET_FILE.to_string(), "data.db-wal"),
            (
                format!("{}{}{}", socket_file_name(9), SWEEP_SUFFIX, dead),
                "data.db-shm",
            ),
        ];
        for (name, target) in &links {
            std::os::unix::fs::symlink(state.join(target), sockets.join(name))
                .expect("a planted link");
        }

        sweep_abandoned_sockets(&sockets);
        sweep_abandoned_sockets(&state);

        for name in stored {
            assert_eq!(
                std::fs::read_to_string(state.join(name)).expect("a surviving state file"),
                name
            );
        }
        for name in &impostors {
            assert_eq!(
                std::fs::read_to_string(state.join(name)).expect("a surviving impostor"),
                *name
            );
        }
        for (name, _) in &links {
            assert!(std::fs::symlink_metadata(sockets.join(name))
                .expect("a surviving link")
                .file_type()
                .is_symlink());
        }
        let planted_staged = vec![impostors[2].clone()];
        assert_eq!(staged_leftovers(&sockets), planted_staged);
        assert_eq!(staged_leftovers(&state), planted_staged);

        let _ = std::fs::remove_dir_all(&state);
    }

    #[cfg(unix)]
    #[test]
    fn a_socket_left_at_the_previous_location_goes_only_once_its_owner_is_gone() {
        let (state, sockets) = state_directory_fixture("upgrade");
        let abandoned = state.join(socket_file_name(0x7fff_fffe));
        let older_build = state.join(socket_file_name(std::process::id()));
        let legacy = state.join(protocol::LEGACY_SOCKET_FILE);
        socket_file(&abandoned);
        socket_file(&older_build);
        let legacy_listener = std::os::unix::net::UnixListener::bind(&legacy).expect("a listener");

        sweep_abandoned_sockets(&sockets);
        sweep_abandoned_sockets(&state);

        assert!(!abandoned.exists());
        assert!(older_build.exists());
        assert!(has_listener(&legacy));
        assert_eq!(staged_leftovers(&state), Vec::<String>::new());

        drop(legacy_listener);
        let _ = std::fs::remove_dir_all(&state);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn a_turn_reaches_the_bridge_through_the_socket_directory_it_is_granted() {
        let (state, sockets) = state_directory_fixture("rt");
        let path = sockets.join(socket_file_name(std::process::id()));
        assert!(fits_socket_address(&path), "{}", path.display());
        let listener = tokio::net::UnixListener::bind(&path).expect("a listener");
        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.expect("a connection");
            serve_lines(stream, |line| async move {
                match serde_json::from_str::<QueryRequest>(&line) {
                    Ok(request) => QueryResponse::ok(serde_json::json!({
                        "workspace": request.workspace_id,
                        "verb": request.verb,
                    })),
                    Err(error) => QueryResponse::failed(error.to_string()),
                }
            })
            .await;
        });
        let request = QueryRequest {
            workspace_id: "ws-1".to_string(),
            session_id: "session-1".to_string(),
            project: String::new(),
            mount: String::new(),
            run_id: None,
            provider: "linear".to_string(),
            verb: "issue".to_string(),
            args: std::collections::BTreeMap::new(),
        };
        let socket = path.to_str().expect("a utf-8 socket path").to_string();

        let response = tokio::task::spawn_blocking(move || cli::ask_at(&socket, &request))
            .await
            .expect("a client thread")
            .expect("an answer");

        assert!(response.ok);
        assert_eq!(
            response.data,
            Some(serde_json::json!({ "workspace": "ws-1", "verb": "issue" }))
        );
        assert_eq!(path.parent(), Some(sockets.as_path()));
        server.await.expect("a served connection");
        let _ = std::fs::remove_dir_all(&state);
    }

    fn injected_names(workspace_id: Option<&str>) -> Vec<String> {
        let mut command = Command::new("true");
        apply_env(&mut command, workspace_id, Some("session-1"));
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
        assert_eq!(names.contains(&SESSION_ENV.to_string()), is_serving());
    }

    #[test]
    fn the_socket_a_child_is_handed_is_the_one_this_instance_binds() {
        let mut command = Command::new("true");
        apply_env(&mut command, Some("ws-1"), Some("session-1"));
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
