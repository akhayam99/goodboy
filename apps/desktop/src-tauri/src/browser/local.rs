use std::fs::{self, File};
use std::io::Read;
use std::path::{Component, Path, PathBuf};

use tauri::http::{header, Method, Request, Response, StatusCode};
use tauri::{Manager, Runtime, Url};

use super::guard::LABEL_PREFIX;
use super::reason::{INVALID_ADDRESS, LOCAL_FOLDER, LOCAL_MISSING, LOCAL_TYPE};
use super::registry::BrowserRegistry;
use crate::util::scoped_path;

pub(crate) const LOCAL_SCHEME: &str = "gblocal";

const LOCAL_HOST: &str = "localhost";
const FILE_SCHEME: &str = "file";
const HOME_PREFIX: &str = "~/";
const MAX_FILE_BYTES: u64 = 64 * 1024 * 1024;
const DISK_ROOTS: &[&str] = &["/Volumes", "/media", "/mnt"];

#[cfg(not(windows))]
const LOCAL_ORIGIN: &str = "gblocal://localhost/";
#[cfg(windows)]
const LOCAL_ORIGIN: &str = "http://gblocal.localhost/";

const PAGE_TYPES: &[(&str, &str)] = &[
    ("html", "text/html"),
    ("htm", "text/html"),
    ("svg", "image/svg+xml"),
    ("png", "image/png"),
    ("jpg", "image/jpeg"),
    ("jpeg", "image/jpeg"),
    ("gif", "image/gif"),
    ("webp", "image/webp"),
    ("avif", "image/avif"),
    ("pdf", "application/pdf"),
];

const PART_TYPES: &[(&str, &str)] = &[
    ("css", "text/css"),
    ("js", "text/javascript"),
    ("mjs", "text/javascript"),
    ("json", "application/json"),
    ("map", "application/json"),
    ("ico", "image/x-icon"),
    ("woff", "font/woff"),
    ("woff2", "font/woff2"),
    ("ttf", "font/ttf"),
    ("otf", "font/otf"),
    ("txt", "text/plain; charset=utf-8"),
    ("md", "text/plain; charset=utf-8"),
    ("mp4", "video/mp4"),
    ("webm", "video/webm"),
];

const ASSET_TYPES: &[&str] = &[
    "css", "js", "mjs", "map", "woff", "woff2", "ttf", "otf", "ico", "svg", "png", "jpg", "jpeg",
    "gif", "webp", "avif",
];

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct LocalGrant {
    pub(crate) token: String,
    pub(crate) folder: PathBuf,
    pub(crate) is_deep: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct LocalFile {
    pub(crate) path: PathBuf,
    pub(crate) folder: PathBuf,
    pub(crate) is_deep: bool,
    pub(crate) query: Option<String>,
    pub(crate) fragment: Option<String>,
}

fn extension_of(path: &Path) -> String {
    path.extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}

fn type_in(path: &Path, table: &[(&str, &'static str)]) -> Option<&'static str> {
    let extension = extension_of(path);
    table
        .iter()
        .find(|(known, _)| *known == extension)
        .map(|(_, kind)| *kind)
}

fn content_type(path: &Path) -> Option<&'static str> {
    type_in(path, PAGE_TYPES).or_else(|| type_in(path, PART_TYPES))
}

#[cfg(windows)]
fn plain(path: PathBuf) -> PathBuf {
    scoped_path::without_verbatim_disk(path)
}

#[cfg(not(windows))]
fn plain(path: PathBuf) -> PathBuf {
    path
}

fn canonical(path: &Path) -> Option<PathBuf> {
    fs::canonicalize(path).ok().map(plain)
}

fn typed_file_address(typed: &str) -> Option<Url> {
    let trimmed = typed.trim();
    if !trimmed.to_ascii_lowercase().starts_with("file:") {
        return None;
    }
    Url::parse(trimmed).ok()
}

fn typed_path(typed: &str, home: Option<&Path>) -> Option<PathBuf> {
    let trimmed = typed.trim();
    if trimmed.to_ascii_lowercase().starts_with("file:") {
        let url = typed_file_address(trimmed)?;
        if url
            .host_str()
            .is_some_and(|host| !host.is_empty() && host != LOCAL_HOST)
        {
            return None;
        }
        return url.to_file_path().ok();
    }
    if let Some(rest) = trimmed.strip_prefix(HOME_PREFIX) {
        return home.map(|home| home.join(rest));
    }
    let path = PathBuf::from(trimmed);
    match path.is_absolute() {
        true => Some(path),
        false => None,
    }
}

#[cfg(unix)]
fn is_mount_root(folder: &Path) -> bool {
    use std::os::unix::fs::MetadataExt;
    let Some(parent) = folder.parent() else {
        return true;
    };
    match (fs::metadata(folder), fs::metadata(parent)) {
        (Ok(own), Ok(above)) => own.dev() != above.dev(),
        _ => true,
    }
}

#[cfg(windows)]
fn is_mount_root(folder: &Path) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
    if folder.parent().is_none() {
        return true;
    }
    match fs::symlink_metadata(folder) {
        Ok(own) => own.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0,
        Err(_) => true,
    }
}

#[cfg(not(any(unix, windows)))]
fn is_mount_root(_folder: &Path) -> bool {
    true
}

fn is_home_or_under_it(folder: &Path, home: Option<&Path>) -> bool {
    let Some(home) = home else {
        return false;
    };
    let Some(home) = canonical(home) else {
        return true;
    };
    folder == home || folder.parent() == Some(home.as_path())
}

fn is_wide(folder: &Path, home: Option<&Path>) -> bool {
    is_wide_place(folder, home) || is_mount_root(folder)
}

fn is_wide_place(folder: &Path, home: Option<&Path>) -> bool {
    let is_home = is_home_or_under_it(folder, home);
    let depth = folder
        .components()
        .filter(|part| matches!(part, Component::Normal(_)))
        .count();
    let is_disk = folder
        .parent()
        .is_some_and(|parent| DISK_ROOTS.iter().any(|root| parent == Path::new(root)));
    is_home || is_disk || depth < 2
}

pub(crate) fn resolve(typed: &str, home: Option<&Path>) -> Result<LocalFile, &'static str> {
    let path = typed_path(typed, home).ok_or(INVALID_ADDRESS)?;
    let path = canonical(&path).ok_or(LOCAL_MISSING)?;
    let meta = fs::metadata(&path).map_err(|_| LOCAL_MISSING)?;
    if meta.is_dir() {
        return Err(LOCAL_FOLDER);
    }
    if !meta.is_file() {
        return Err(LOCAL_MISSING);
    }
    if type_in(&path, PAGE_TYPES).is_none() {
        return Err(LOCAL_TYPE);
    }
    let folder = path.parent().ok_or(LOCAL_MISSING)?.to_path_buf();
    let is_deep = !is_wide(&folder, home);
    let address = typed_file_address(typed);
    Ok(LocalFile {
        path,
        folder,
        is_deep,
        query: address
            .as_ref()
            .and_then(|url| url.query().map(str::to_string)),
        fragment: address
            .as_ref()
            .and_then(|url| url.fragment().map(str::to_string)),
    })
}

pub(crate) fn routed(mut url: Url, query: Option<&str>, fragment: Option<&str>) -> Url {
    url.set_query(query);
    url.set_fragment(fragment);
    url
}

pub(crate) fn is_local_address(url: &Url) -> bool {
    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    if url.scheme() == LOCAL_SCHEME {
        return host == LOCAL_HOST;
    }
    let is_web = url.scheme() == "http" || url.scheme() == "https";
    is_web && host == format!("{LOCAL_SCHEME}.{LOCAL_HOST}")
}

pub(crate) fn is_file_address(url: &Url) -> bool {
    url.scheme() == FILE_SCHEME && url.to_file_path().is_ok()
}

pub(crate) fn live_url(token: &str, path: &Path) -> Option<Url> {
    let file = Url::from_file_path(path).ok()?;
    let mut url = Url::parse(LOCAL_ORIGIN).ok()?;
    url.set_path(&format!("/{token}{}", file.path()));
    Some(url)
}

pub(crate) fn split_live(url: &Url) -> Option<(String, PathBuf)> {
    if !is_local_address(url) {
        return None;
    }
    let (token, rest) = url.path().trim_start_matches('/').split_once('/')?;
    if token.is_empty() || !token.chars().all(|c| c.is_ascii_hexdigit() || c == '-') {
        return None;
    }
    let mut file = Url::parse("file:///").ok()?;
    file.set_path(&format!("/{rest}"));
    let path = file.to_file_path().ok()?;
    Some((token.to_string(), path))
}

pub(crate) fn shown_address(url: &Url) -> String {
    split_live(url)
        .and_then(|(_, path)| Url::from_file_path(path).ok())
        .map(|file| routed(file, url.query(), url.fragment()).to_string())
        .unwrap_or_else(|| url.to_string())
}

fn is_hidden(part: &Component<'_>) -> bool {
    match part {
        Component::Normal(name) => name.to_str().is_none_or(|name| name.starts_with('.')),
        _ => true,
    }
}

fn is_inside(grant: &LocalGrant, path: &Path) -> bool {
    let Ok(below) = path.strip_prefix(&grant.folder) else {
        return false;
    };
    let parts: Vec<Component<'_>> = below.components().collect();
    if parts.is_empty() || parts.iter().any(is_hidden) {
        return false;
    }
    if parts.len() == 1 {
        return true;
    }
    grant.is_deep && ASSET_TYPES.contains(&extension_of(path).as_str())
}

pub(crate) fn grants_path(grant: &LocalGrant, path: &Path) -> bool {
    path.is_absolute() && is_inside(grant, path)
}

fn checked(grant: &LocalGrant, path: &Path) -> Option<PathBuf> {
    if !grants_path(grant, path) {
        return None;
    }
    let real = canonical(path)?;
    match is_inside(grant, &real) {
        true => Some(real),
        false => None,
    }
}

fn open_checked(grant: &LocalGrant, real: &Path) -> Option<File> {
    let relative = real.strip_prefix(&grant.folder).ok()?;
    let file = scoped_path::open_confined(&grant.folder, relative).ok()?;
    let meta = file.metadata().ok()?;
    if !meta.is_file() || meta.len() > MAX_FILE_BYTES {
        return None;
    }
    Some(file)
}

fn read_capped(file: File) -> Option<Vec<u8>> {
    let mut body = Vec::new();
    file.take(MAX_FILE_BYTES + 1).read_to_end(&mut body).ok()?;
    match body.len() as u64 > MAX_FILE_BYTES {
        true => None,
        false => Some(body),
    }
}

fn readable(grant: &LocalGrant, path: &Path) -> Option<(PathBuf, File)> {
    let real = checked(grant, path)?;
    let file = open_checked(grant, &real)?;
    Some((real, file))
}

fn not_found() -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .header(header::CACHE_CONTROL, "no-store")
        .body(b"not found".to_vec())
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

pub(crate) fn serve(grant: Option<&LocalGrant>, path: &Path) -> Response<Vec<u8>> {
    let Some((real, file)) = grant.and_then(|grant| readable(grant, path)) else {
        return not_found();
    };
    let Some(kind) = content_type(&real) else {
        return not_found();
    };
    let Some(body) = read_capped(file) else {
        return not_found();
    };
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, kind)
        .header(header::CACHE_CONTROL, "no-store")
        .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
        .header(header::REFERRER_POLICY, "no-referrer")
        .header("Cross-Origin-Resource-Policy", "same-origin")
        .body(body)
        .unwrap_or_else(|_| not_found())
}

pub(crate) fn may_load(registry: &BrowserRegistry, tab_id: &str, target: &Url) -> bool {
    let Some((token, path)) = split_live(target) else {
        return false;
    };
    registry
        .local_grant(tab_id, &token)
        .is_some_and(|grant| grants_path(&grant, &path))
}

pub(crate) fn reopen_url(registry: &BrowserRegistry, tab_id: &str, address: &Url) -> Option<Url> {
    let path = address.to_file_path().ok()?;
    let grant = registry.grant_covering(tab_id, &path)?;
    live_url(&grant.token, &path).map(|live| routed(live, address.query(), address.fragment()))
}

pub(crate) fn handle<R: Runtime>(
    ctx: tauri::UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
    responder: tauri::UriSchemeResponder,
) {
    let is_read = request.method() == Method::GET || request.method() == Method::HEAD;
    let tab_id = ctx.webview_label().strip_prefix(LABEL_PREFIX);
    let target = Url::parse(&request.uri().to_string())
        .ok()
        .and_then(|url| split_live(&url));
    let found = match (is_read, tab_id, target) {
        (true, Some(tab_id), Some((token, path))) => ctx
            .app_handle()
            .state::<BrowserRegistry>()
            .local_grant(tab_id, &token)
            .map(|grant| (grant, path)),
        _ => None,
    };
    tauri::async_runtime::spawn_blocking(move || {
        let response = match found {
            Some((grant, path)) => serve(Some(&grant), &path),
            None => not_found(),
        };
        responder.respond(response);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Folder {
        root: PathBuf,
    }

    impl Folder {
        fn new() -> Self {
            let root =
                std::env::temp_dir().join(format!("goodboy-local-{}", crate::util::uuid_v4()));
            fs::create_dir_all(&root).expect("folder");
            Self {
                root: canonical(&root).expect("canonical folder"),
            }
        }

        fn write(&self, relative: &str, contents: &str) -> PathBuf {
            let path = self.root.join(relative);
            fs::create_dir_all(path.parent().expect("parent")).expect("parents");
            fs::write(&path, contents).expect("write");
            path
        }
    }

    impl Drop for Folder {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    fn plan_file() -> LocalFile {
        LocalFile {
            path: PathBuf::from("/work/harborline/plan.html"),
            folder: PathBuf::from("/work/harborline"),
            is_deep: true,
            query: None,
            fragment: None,
        }
    }

    fn grant_of(file: &LocalFile) -> LocalGrant {
        LocalGrant {
            token: "0f1e".to_string(),
            folder: file.folder.clone(),
            is_deep: file.is_deep,
        }
    }

    fn status(grant: &LocalGrant, path: &Path) -> StatusCode {
        serve(Some(grant), path).status()
    }

    #[test]
    fn resolves_an_absolute_path_a_home_path_and_a_file_address() {
        let folder = Folder::new();
        let plan = folder.write("harborline/plan.html", "<title>Plan</title>");
        let absolute = resolve(plan.to_str().expect("utf8"), None).expect("absolute");
        assert_eq!(absolute.path, plan);
        assert_eq!(absolute.folder, folder.root.join("harborline"));
        assert!(absolute.is_deep);
        let home = resolve("~/harborline/plan.html", Some(&folder.root)).expect("home");
        assert_eq!(home.path, plan);
        let address = Url::from_file_path(&plan)
            .expect("file address")
            .to_string();
        assert_eq!(resolve(&address, None).expect("file").path, plan);
    }

    #[test]
    fn refuses_a_missing_file_a_folder_and_a_file_it_cannot_show() {
        let folder = Folder::new();
        folder.write("harborline/notes.ts", "export {}");
        let root = folder.root.to_str().expect("utf8");
        assert_eq!(
            resolve(&format!("{root}/harborline/gone.html"), None),
            Err(LOCAL_MISSING)
        );
        assert_eq!(
            resolve(&format!("{root}/harborline"), None),
            Err(LOCAL_FOLDER)
        );
        assert_eq!(
            resolve(&format!("{root}/harborline/notes.ts"), None),
            Err(LOCAL_TYPE)
        );
        assert_eq!(resolve("harborline/plan.html", None), Err(INVALID_ADDRESS));
        assert_eq!(resolve("~/plan.html", None), Err(INVALID_ADDRESS));
        assert_eq!(
            resolve("file://acme.example/plan.html", None),
            Err(INVALID_ADDRESS)
        );
    }

    #[test]
    fn opens_an_image_and_a_pdf_as_well_as_a_page() {
        let folder = Folder::new();
        for name in ["shot.png", "spec.pdf", "board.svg", "page.htm"] {
            let path = folder.write(&format!("acme/{name}"), "x");
            assert!(
                resolve(path.to_str().expect("utf8"), None).is_ok(),
                "{name}"
            );
        }
    }

    #[test]
    fn serves_the_page_and_the_files_beside_and_under_it() {
        let folder = Folder::new();
        let plan = folder.write("harborline/plan.html", "<title>Plan</title>");
        let styles = folder.write("harborline/mocks/plan.css", "p {}");
        let grant = grant_of(&resolve(plan.to_str().expect("utf8"), None).expect("plan"));
        let page = serve(Some(&grant), &plan);
        assert_eq!(page.status(), StatusCode::OK);
        assert_eq!(page.headers()[header::CONTENT_TYPE], "text/html");
        assert_eq!(page.headers()[header::REFERRER_POLICY], "no-referrer");
        assert_eq!(page.headers()[header::CACHE_CONTROL], "no-store");
        assert_eq!(page.body(), b"<title>Plan</title>");
        assert_eq!(status(&grant, &styles), StatusCode::OK);
    }

    #[test]
    fn refuses_a_path_outside_the_folder_or_climbing_out_of_it() {
        let folder = Folder::new();
        let plan = folder.write("harborline/plan.html", "x");
        let secret = folder.write("northwind/ledger.json", "{}");
        let grant = grant_of(&resolve(plan.to_str().expect("utf8"), None).expect("plan"));
        assert_eq!(status(&grant, &secret), StatusCode::NOT_FOUND);
        let climb = folder.root.join("harborline/../northwind/ledger.json");
        assert_eq!(status(&grant, &climb), StatusCode::NOT_FOUND);
        assert_eq!(
            status(&grant, Path::new("northwind/ledger.json")),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            status(&grant, &folder.root.join("harborline")),
            StatusCode::NOT_FOUND
        );
    }

    #[test]
    fn refuses_hidden_files_and_hidden_folders_under_the_folder() {
        let folder = Folder::new();
        let plan = folder.write("harborline/plan.html", "x");
        let env = folder.write("harborline/.env", "TOKEN=x");
        let hidden = folder.write("harborline/.git/config.json", "{}");
        let grant = grant_of(&resolve(plan.to_str().expect("utf8"), None).expect("plan"));
        assert_eq!(status(&grant, &env), StatusCode::NOT_FOUND);
        assert_eq!(status(&grant, &hidden), StatusCode::NOT_FOUND);
    }

    #[test]
    fn refuses_a_file_type_it_does_not_serve() {
        let folder = Folder::new();
        let plan = folder.write("harborline/plan.html", "x");
        let key = folder.write("harborline/deploy.pem", "x");
        let grant = grant_of(&resolve(plan.to_str().expect("utf8"), None).expect("plan"));
        assert_eq!(status(&grant, &key), StatusCode::NOT_FOUND);
    }

    #[test]
    fn refuses_without_a_grant() {
        let folder = Folder::new();
        let plan = folder.write("harborline/plan.html", "x");
        assert_eq!(serve(None, &plan).status(), StatusCode::NOT_FOUND);
    }

    #[cfg(unix)]
    #[test]
    fn follows_a_link_only_when_its_target_stays_inside_the_folder() {
        let folder = Folder::new();
        let plan = folder.write("harborline/plan.html", "x");
        let outside = folder.write("northwind/ledger.json", "{}");
        let inside = folder.write("harborline/mocks/a.css", "p {}");
        let out_link = folder.root.join("harborline/ledger.json");
        let in_link = folder.root.join("harborline/a.css");
        std::os::unix::fs::symlink(&outside, &out_link).expect("link out");
        std::os::unix::fs::symlink(&inside, &in_link).expect("link in");
        let grant = grant_of(&resolve(plan.to_str().expect("utf8"), None).expect("plan"));
        assert_eq!(status(&grant, &out_link), StatusCode::NOT_FOUND);
        assert_eq!(status(&grant, &in_link), StatusCode::OK);
    }

    #[cfg(unix)]
    #[test]
    fn refuses_a_file_swapped_for_a_link_after_it_was_checked() {
        let folder = Folder::new();
        let plan = folder.write("harborline/plan.html", "x");
        let styles = folder.write("harborline/plan.css", "p {}");
        let env = folder.write("harborline/.env", "TOKEN=x");
        let grant = grant_of(&resolve(plan.to_str().expect("utf8"), None).expect("plan"));
        let real = checked(&grant, &styles).expect("checked");
        fs::remove_file(&styles).expect("remove");
        std::os::unix::fs::symlink(&env, &styles).expect("swap");
        assert!(open_checked(&grant, &real).is_none());
    }

    #[cfg(unix)]
    #[test]
    fn refuses_a_folder_swapped_for_a_link_after_it_was_checked() {
        let folder = Folder::new();
        let plan = folder.write("harborline/plan.html", "x");
        let styles = folder.write("harborline/mocks/plan.css", "p {}");
        folder.write("northwind/plan.css", "secret");
        let grant = grant_of(&resolve(plan.to_str().expect("utf8"), None).expect("plan"));
        let real = checked(&grant, &styles).expect("checked");
        let mocks = folder.root.join("harborline/mocks");
        fs::rename(&mocks, folder.root.join("harborline/moved")).expect("move");
        std::os::unix::fs::symlink(folder.root.join("northwind"), &mocks).expect("swap");
        assert!(open_checked(&grant, &real).is_none());
    }

    #[test]
    fn reads_no_more_than_the_limit_from_the_open_file() {
        let folder = Folder::new();
        let page = folder.write("harborline/plan.html", "<title>Plan</title>");
        let file = File::open(&page).expect("open");
        assert_eq!(read_capped(file), Some(b"<title>Plan</title>".to_vec()));
    }

    #[test]
    fn keeps_the_query_and_fragment_of_a_typed_file_address() {
        let folder = Folder::new();
        let plan = folder.write("harborline/plan.html", "x");
        let address = Url::from_file_path(&plan).expect("file address");
        let typed = format!("{address}?step=2#/checkout");
        let file = resolve(&typed, None).expect("routed file");
        assert_eq!(file.path, plan);
        assert_eq!(file.query.as_deref(), Some("step=2"));
        assert_eq!(file.fragment.as_deref(), Some("/checkout"));
        let plain_file = resolve(plan.to_str().expect("utf8"), None).expect("plain");
        assert_eq!(plain_file.query, None);
        assert_eq!(plain_file.fragment, None);
    }

    #[cfg(unix)]
    #[test]
    fn keeps_a_page_at_the_top_of_a_mounted_volume_to_the_files_beside_it() {
        let folder = Folder::new();
        folder.write("harborline/plan.html", "x");
        let inner = folder.root.join("harborline");
        assert!(!is_mount_root(&inner));
        assert!(!is_wide(&inner, None));
        assert!(is_mount_root(Path::new("/dev")));
        assert!(is_mount_root(Path::new("/")));
    }

    #[cfg(windows)]
    #[test]
    fn compares_a_drive_path_the_way_a_file_address_gives_it_back() {
        let verbatim = PathBuf::from(r"\\?\C:\work\harborline");
        assert_eq!(plain(verbatim), PathBuf::from(r"C:\work\harborline"));
        let grant = LocalGrant {
            token: "0f1e".to_string(),
            folder: PathBuf::from(r"C:\work\harborline"),
            is_deep: true,
        };
        let live = live_url("0f1e", Path::new(r"C:\work\harborline\plan.html")).expect("live");
        let (_, path) = split_live(&live).expect("split");
        assert!(grants_path(&grant, &path));
    }

    #[test]
    fn keeps_a_page_in_the_home_folder_to_the_files_beside_it() {
        let folder = Folder::new();
        let plan = folder.write("plan.html", "x");
        let deeper = folder.write("ledger-core/notes.json", "{}");
        let file = resolve("~/plan.html", Some(&folder.root)).expect("home page");
        assert!(!file.is_deep);
        let grant = grant_of(&file);
        assert_eq!(status(&grant, &plan), StatusCode::OK);
        assert_eq!(status(&grant, &deeper), StatusCode::NOT_FOUND);
    }

    #[test]
    fn serves_only_static_assets_from_the_folders_below_the_page() {
        let folder = Folder::new();
        let plan = folder.write("harborline/index.html", "x");
        let grant = grant_of(&resolve(plan.to_str().expect("utf8"), None).expect("plan"));
        for asset in ["css/site.css", "js/app.js", "img/logo.png", "fonts/a.woff2"] {
            let path = folder.write(&format!("harborline/{asset}"), "x");
            assert_eq!(status(&grant, &path), StatusCode::OK, "{asset}");
        }
        for kept in [
            "ledger/ledger.json",
            "docs/guide.html",
            "scans/spec.pdf",
            "notes/plan.md",
            "clips/demo.mp4",
        ] {
            let path = folder.write(&format!("harborline/{kept}"), "x");
            assert_eq!(status(&grant, &path), StatusCode::NOT_FOUND, "{kept}");
        }
        let beside = folder.write("harborline/ledger.json", "{}");
        assert_eq!(status(&grant, &beside), StatusCode::OK);
    }

    #[test]
    fn keeps_a_page_in_a_folder_right_under_home_to_the_files_beside_it() {
        let folder = Folder::new();
        let plan = folder.write("downloads/plan.html", "x");
        let beside = folder.write("downloads/ledger.json", "{}");
        let below = folder.write("downloads/northwind/site.css", "p {}");
        let file = resolve("~/downloads/plan.html", Some(&folder.root)).expect("page");
        assert!(!file.is_deep);
        let grant = grant_of(&file);
        assert_eq!(status(&grant, &plan), StatusCode::OK);
        assert_eq!(status(&grant, &beside), StatusCode::OK);
        assert_eq!(status(&grant, &below), StatusCode::NOT_FOUND);
        let nested = folder.write("downloads/acme/plan.html", "x");
        let file = resolve(nested.to_str().expect("utf8"), Some(&folder.root)).expect("nested");
        assert!(file.is_deep);
    }

    #[test]
    fn treats_a_folder_it_cannot_check_as_wide() {
        let folder = Folder::new();
        let gone = folder.root.join("gone/harborline");
        assert!(is_mount_root(&gone));
        assert!(is_wide(&gone, None));
        assert!(is_wide(&folder.root.join("harborline"), Some(&gone)));
    }

    #[test]
    fn revokes_the_grants_of_a_tab_while_it_stays_open() {
        let registry = BrowserRegistry::default();
        crate::browser::tests::seed_local_tab(&registry, "tab-a");
        let file = plan_file();
        let token = registry.grant_local("tab-a", &file).expect("grant");
        registry.revoke_local("tab-a");
        assert_eq!(registry.local_grant("tab-a", &token), None);
        assert!(registry.facts("tab-a").is_some());
    }

    #[test]
    fn keeps_a_page_at_the_top_of_a_disk_or_the_root_to_the_files_beside_it() {
        assert!(is_wide_place(Path::new("/Volumes/acme"), None));
        assert!(is_wide_place(Path::new("/mnt/acme"), None));
        assert!(is_wide_place(Path::new("/work"), None));
        assert!(!is_wide_place(Path::new("/Volumes/acme/harborline"), None));
        assert!(!is_wide_place(Path::new("/work/harborline"), None));
    }

    #[test]
    fn writes_the_path_into_a_live_address_and_reads_it_back() {
        let path = PathBuf::from("/work/harborline/plan v2.html");
        let live = live_url("0f1e-2a", &path).expect("live address");
        assert!(is_local_address(&live));
        assert_eq!(
            split_live(&live),
            Some(("0f1e-2a".to_string(), path.clone()))
        );
        assert_eq!(
            shown_address(&live),
            "file:///work/harborline/plan%20v2.html"
        );
        assert_eq!(
            shown_address(&Url::parse("https://acme.example/").expect("web")),
            "https://acme.example/"
        );
    }

    #[test]
    fn reads_no_path_from_an_address_that_is_not_local() {
        for address in [
            "https://acme.example/0f1e/work/plan.html",
            "gblocal://acme.example/0f1e/work/plan.html",
            "gbframe://localhost/0f1e/plan.html",
            "gblocal://localhost/not-a-token!/work/plan.html",
            "gblocal://localhost/0f1e",
        ] {
            let url = Url::parse(address).expect("address");
            assert_eq!(split_live(&url), None, "{address}");
        }
        assert!(is_local_address(
            &Url::parse("http://gblocal.localhost/0f1e/work/plan.html").expect("windows form")
        ));
    }

    #[test]
    fn lets_a_tab_load_only_what_its_own_grant_covers() {
        let registry = BrowserRegistry::default();
        crate::browser::tests::seed_local_tab(&registry, "tab-a");
        crate::browser::tests::seed_local_tab(&registry, "tab-b");
        let file = plan_file();
        let token = registry.grant_local("tab-a", &file).expect("grant");
        let page = live_url(&token, &file.path).expect("live");
        let sibling = live_url(&token, Path::new("/work/harborline/a.html")).expect("live");
        let asset = live_url(&token, Path::new("/work/harborline/mocks/a.css")).expect("live");
        let sub_page = live_url(&token, Path::new("/work/harborline/mocks/a.html")).expect("live");
        let outside = live_url(&token, Path::new("/work/northwind/a.html")).expect("live");
        let forged = live_url("0f1e", &file.path).expect("live");
        assert!(may_load(&registry, "tab-a", &page));
        assert!(may_load(&registry, "tab-a", &sibling));
        assert!(may_load(&registry, "tab-a", &asset));
        assert!(!may_load(&registry, "tab-a", &sub_page));
        assert!(!may_load(&registry, "tab-a", &outside));
        assert!(!may_load(&registry, "tab-a", &forged));
        assert!(!may_load(&registry, "tab-b", &page));
        assert!(!may_load(
            &registry,
            "tab-a",
            &Url::parse("https://acme.example/").expect("web")
        ));
    }

    #[test]
    fn reuses_one_grant_per_folder_and_forgets_it_with_the_tab() {
        let registry = BrowserRegistry::default();
        crate::browser::tests::seed_local_tab(&registry, "tab-a");
        let file = plan_file();
        let first = registry.grant_local("tab-a", &file).expect("grant");
        let second = registry.grant_local("tab-a", &file).expect("grant");
        assert_eq!(first, second);
        let address = Url::from_file_path(&file.path).expect("file");
        assert_eq!(
            reopen_url(&registry, "tab-a", &address),
            live_url(&first, &file.path)
        );
        let routed_address = routed(address, Some("step=2"), Some("/checkout"));
        let reopened = reopen_url(&registry, "tab-a", &routed_address).expect("reopens");
        assert_eq!(reopened.query(), Some("step=2"));
        assert_eq!(reopened.fragment(), Some("/checkout"));
        assert_eq!(shown_address(&reopened), routed_address.to_string());
        registry.remove("tab-a");
        assert_eq!(registry.local_grant("tab-a", &first), None);
        assert_eq!(registry.grant_local("tab-a", &file), None);
    }
}
