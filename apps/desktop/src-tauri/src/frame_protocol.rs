use std::collections::HashMap;
use std::sync::Mutex;

use tauri::http::{header, Request, Response, StatusCode};

use crate::artifact_folder::{is_safe_segment, FolderFile};
use crate::artifacts::ArtifactExportError;

pub const FRAME_SCHEME: &str = "gbframe";

pub const FRAME_CSP: &str = "default-src 'none'; style-src gbframe: http://gbframe.localhost; script-src gbframe: http://gbframe.localhost; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";

const STAGE_SCRIPT: &str = include_str!("frame_stage.js");

const STAGE_STYLES: &str = include_str!("frame_stage.css");

const STAGE_ASSET_DIR: &str = "_gb";

const STAGE_INJECTION: &str =
    "<link rel=\"stylesheet\" href=\"/_gb/stage.css\"><script src=\"/_gb/stage.js\"></script>";

pub const MAX_STAGE_STORE_BYTES: usize = 16 * 1024 * 1024;

const MAX_STAGE_FILES: usize = 512;

const MAX_STAGE_DEPTH: usize = 3;

const STAGE_EXTENSIONS: [&str; 4] = ["html", "css", "json", "md"];

fn refused(message: &str) -> ArtifactExportError {
    ArtifactExportError::Destination(message.to_string())
}

struct Stage {
    files: HashMap<String, String>,
    bytes: usize,
    used: u64,
}

#[derive(Default)]
pub struct StageStore {
    stages: HashMap<String, Stage>,
    clock: u64,
    bytes: usize,
}

fn is_stage_path(path: &str) -> bool {
    let segments: Vec<&str> = path.split('/').collect();
    if segments.is_empty() || segments.len() > MAX_STAGE_DEPTH {
        return false;
    }
    if !segments.iter().all(|segment| is_safe_segment(segment)) {
        return false;
    }
    let extension = path.rsplit_once('.').map(|(_, ext)| ext).unwrap_or("");
    STAGE_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str())
}

impl StageStore {
    fn tick(&mut self) -> u64 {
        self.clock += 1;
        self.clock
    }

    pub fn insert(&mut self, files: Vec<FolderFile>) -> Result<String, ArtifactExportError> {
        if files.is_empty() {
            return Err(ArtifactExportError::Empty);
        }
        if files.len() > MAX_STAGE_FILES {
            return Err(refused("the frame has too many files"));
        }
        let bytes: usize = files.iter().map(|file| file.contents.len()).sum();
        if bytes > MAX_STAGE_STORE_BYTES {
            return Err(ArtifactExportError::TooLarge);
        }
        let mut map = HashMap::with_capacity(files.len());
        for file in files {
            if !is_stage_path(&file.path) {
                return Err(ArtifactExportError::Destination(format!(
                    "{} is not a plain page path",
                    file.path
                )));
            }
            map.insert(file.path, file.contents);
        }
        let id = crate::util::uuid_v4();
        let used = self.tick();
        self.bytes += bytes;
        self.stages.insert(
            id.clone(),
            Stage {
                files: map,
                bytes,
                used,
            },
        );
        self.evict(&id);
        Ok(id)
    }

    fn evict(&mut self, keep: &str) {
        while self.bytes > MAX_STAGE_STORE_BYTES {
            let oldest = self
                .stages
                .iter()
                .filter(|(id, _)| id.as_str() != keep)
                .min_by_key(|(_, stage)| stage.used)
                .map(|(id, _)| id.clone());
            let Some(oldest) = oldest else {
                return;
            };
            self.release(&oldest);
        }
    }

    pub fn release(&mut self, id: &str) -> bool {
        let Some(stage) = self.stages.remove(id) else {
            return false;
        };
        self.bytes -= stage.bytes;
        true
    }

    pub fn read(&mut self, id: &str, path: &str) -> Option<String> {
        let used = self.tick();
        let stage = self.stages.get_mut(id)?;
        stage.used = used;
        stage.files.get(path).cloned()
    }

    #[cfg(test)]
    pub fn has(&self, id: &str) -> bool {
        self.stages.contains_key(id)
    }
}

#[derive(Default)]
pub struct FrameStages(pub Mutex<StageStore>);

fn content_type(path: &str) -> &'static str {
    let extension = path
        .rsplit_once('.')
        .map(|(_, ext)| ext.to_ascii_lowercase())
        .unwrap_or_default();
    match extension.as_str() {
        "html" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        _ => "text/plain; charset=utf-8",
    }
}

pub fn inject_stage(html: &str) -> String {
    let Some(start) = html.find("<head>") else {
        return format!("{STAGE_INJECTION}{html}");
    };
    let at = start + "<head>".len();
    format!("{}{}{}", &html[..at], STAGE_INJECTION, &html[at..])
}

fn respond(status: StatusCode, path: &str, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type(path))
        .header(header::CONTENT_SECURITY_POLICY, FRAME_CSP)
        .header(header::CACHE_CONTROL, "no-store")
        .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
        .body(body)
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

fn not_found() -> Response<Vec<u8>> {
    respond(StatusCode::NOT_FOUND, "missing.txt", b"not found".to_vec())
}

pub fn serve(store: &mut StageStore, path: &str) -> Response<Vec<u8>> {
    let trimmed = path.trim_start_matches('/');
    if trimmed.contains('%') || trimmed.contains('\\') {
        return not_found();
    }
    let Some((head, rest)) = trimmed.split_once('/') else {
        return not_found();
    };
    if head == STAGE_ASSET_DIR {
        return match rest {
            "stage.js" => respond(StatusCode::OK, rest, STAGE_SCRIPT.as_bytes().to_vec()),
            "stage.css" => respond(StatusCode::OK, rest, STAGE_STYLES.as_bytes().to_vec()),
            _ => not_found(),
        };
    }
    if !is_safe_segment(head) || !is_stage_path(rest) {
        return not_found();
    }
    let Some(contents) = store.read(head, rest) else {
        return not_found();
    };
    if rest.ends_with(".html") {
        return respond(StatusCode::OK, rest, inject_stage(&contents).into_bytes());
    }
    respond(StatusCode::OK, rest, contents.into_bytes())
}

pub fn handle<R: tauri::Runtime>(
    ctx: tauri::UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
    responder: tauri::UriSchemeResponder,
) {
    use tauri::Manager;
    let path = request.uri().path().to_string();
    let stages = ctx.app_handle().state::<FrameStages>();
    let response = match stages.0.lock() {
        Ok(mut store) => serve(&mut store, &path),
        Err(_) => not_found(),
    };
    responder.respond(response);
}

#[tauri::command]
pub fn frame_stage(
    stages: tauri::State<'_, FrameStages>,
    files: Vec<FolderFile>,
) -> Result<String, ArtifactExportError> {
    let mut store = stages
        .0
        .lock()
        .map_err(|_| refused("the frame store is unavailable"))?;
    store.insert(files)
}

#[tauri::command]
pub fn frame_release(
    stages: tauri::State<'_, FrameStages>,
    stage_id: String,
) -> Result<bool, ArtifactExportError> {
    let mut store = stages
        .0
        .lock()
        .map_err(|_| refused("the frame store is unavailable"))?;
    Ok(store.release(&stage_id))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file(path: &str, contents: &str) -> FolderFile {
        FolderFile {
            path: path.to_string(),
            contents: contents.to_string(),
        }
    }

    fn page() -> String {
        "<!doctype html><html><head><title>x</title></head><body><p>x</p></body></html>".into()
    }

    fn header_of(response: &Response<Vec<u8>>, name: header::HeaderName) -> String {
        response
            .headers()
            .get(name)
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
            .to_string()
    }

    #[test]
    fn serves_a_staged_page_with_its_own_csp_and_the_stage_script() {
        let mut store = StageStore::default();
        let id = store
            .insert(vec![
                file("index.html", &page()),
                file("screens/a.html", &page()),
                file("wireframe.css", "p { color: red; }"),
            ])
            .expect("stage");
        let response = serve(&mut store, &format!("/{id}/screens/a.html"));
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            header_of(&response, header::CONTENT_SECURITY_POLICY),
            FRAME_CSP
        );
        assert_eq!(header_of(&response, header::CACHE_CONTROL), "no-store");
        let body = String::from_utf8(response.body().clone()).expect("utf8");
        assert!(body.contains("<head><link rel=\"stylesheet\" href=\"/_gb/stage.css\"><script src=\"/_gb/stage.js\"></script><title>"));
        let css = serve(&mut store, &format!("/{id}/wireframe.css"));
        assert_eq!(
            header_of(&css, header::CONTENT_TYPE),
            "text/css; charset=utf-8"
        );
        assert!(!String::from_utf8(css.body().clone())
            .expect("utf8")
            .contains("stage.js"));
    }

    #[test]
    fn serves_the_stage_assets_from_any_page() {
        let mut store = StageStore::default();
        let script = serve(&mut store, "/_gb/stage.js");
        assert_eq!(script.status(), StatusCode::OK);
        assert!(String::from_utf8(script.body().clone())
            .expect("utf8")
            .contains("postMessage"));
        assert_eq!(
            serve(&mut store, "/_gb/other.js").status(),
            StatusCode::NOT_FOUND
        );
    }

    #[test]
    fn the_csp_blocks_network_forms_and_parent_ipc() {
        assert!(FRAME_CSP.contains("connect-src 'none'"));
        assert!(FRAME_CSP.contains("form-action 'none'"));
        assert!(FRAME_CSP.starts_with("default-src 'none'"));
        assert!(!FRAME_CSP.contains("'unsafe-inline'"));
    }

    #[test]
    fn refuses_paths_that_climb_or_hide() {
        let mut store = StageStore::default();
        let id = store
            .insert(vec![file("index.html", &page())])
            .expect("stage");
        for path in [
            format!("/{id}/../index.html"),
            format!("/{id}/.hidden.html"),
            format!("/{id}/%2e%2e/index.html"),
            format!("/{id}/index.exe"),
            format!("/{id}"),
            "/../etc/passwd".to_string(),
            "/unknown/index.html".to_string(),
        ] {
            assert_eq!(
                serve(&mut store, &path).status(),
                StatusCode::NOT_FOUND,
                "{path}"
            );
        }
        assert!(store.insert(vec![file("../x.html", "x")]).is_err());
        assert!(store.insert(vec![file("a/b/c/d.html", "x")]).is_err());
        assert!(store.insert(vec![]).is_err());
    }

    #[test]
    fn evicts_the_least_recently_used_stage_past_the_budget() {
        let mut store = StageStore::default();
        let big = "x".repeat(MAX_STAGE_STORE_BYTES / 2 - 16);
        let first = store.insert(vec![file("index.html", &big)]).expect("first");
        let second = store
            .insert(vec![file("index.html", &big)])
            .expect("second");
        assert!(store.read(&first, "index.html").is_some());
        let third = store.insert(vec![file("index.html", &big)]).expect("third");
        assert!(store.has(&first));
        assert!(!store.has(&second));
        assert!(store.has(&third));
        assert!(store.release(&first));
        assert!(!store.release(&first));
    }

    #[test]
    fn injects_before_the_document_when_there_is_no_head() {
        assert!(inject_stage("<p>x</p>").starts_with("<link rel=\"stylesheet\""));
    }
}
