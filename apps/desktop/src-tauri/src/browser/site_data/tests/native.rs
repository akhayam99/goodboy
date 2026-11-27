use std::cell::RefCell;
use std::ffi::{CStr, CString};
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::rc::Rc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use block2::RcBlock;
use objc2::encode::{Encode, Encoding};
use objc2::rc::{autoreleasepool, Allocated, Retained};
use objc2::runtime::{AnyClass, AnyObject, Bool, ClassBuilder, Sel};
use objc2::{class, msg_send, sel};

use crate::browser::load::remember_load;
use crate::browser::profile::ProfileId;
use crate::browser::registry::{BrowserRegistry, NewTab};
use crate::platform::web_site_data::text_of;

const TAB: &str = "probe-tab";
const PROBE_ENV: &str = "GOODBOY_SITE_DATA_PROBE";
const CHILD_LIMIT: Duration = Duration::from_secs(55);
const STEP_LIMIT: Duration = Duration::from_secs(8);
const SETTLE: Duration = Duration::from_millis(1500);
const PROHIBITED_POLICY: isize = 2;
const DELEGATE_CLASS: &CStr = c"GoodboyTrailProbeDelegate";
const PROBE_COOKIE_DOMAINS: [&str; 6] = [
    "app.harborline.dev",
    "login.cascadia-id.com",
    "harborline.github.io",
    "shop.acme.co.uk",
    "app.northwind.test",
    "localhost",
];

static REGISTRY: OnceLock<BrowserRegistry> = OnceLock::new();
static LOADS: Mutex<Vec<(String, String)>> = Mutex::new(Vec::new());

extern "C" {
    fn pthread_main_np() -> i32;
}

#[repr(C)]
#[derive(Clone, Copy)]
struct Point {
    x: f64,
    y: f64,
}

#[repr(C)]
#[derive(Clone, Copy)]
struct Size {
    width: f64,
    height: f64,
}

#[repr(C)]
#[derive(Clone, Copy)]
struct Rect {
    origin: Point,
    size: Size,
}

unsafe impl Encode for Point {
    const ENCODING: Encoding = Encoding::Struct("CGPoint", &[f64::ENCODING, f64::ENCODING]);
}

unsafe impl Encode for Size {
    const ENCODING: Encoding = Encoding::Struct("CGSize", &[f64::ENCODING, f64::ENCODING]);
}

unsafe impl Encode for Rect {
    const ENCODING: Encoding = Encoding::Struct("CGRect", &[Point::ENCODING, Size::ENCODING]);
}

type NavigationFn =
    unsafe extern "C-unwind" fn(*mut AnyObject, Sel, *mut AnyObject, *mut AnyObject);
type FailFn = unsafe extern "C-unwind" fn(
    *mut AnyObject,
    Sel,
    *mut AnyObject,
    *mut AnyObject,
    *mut AnyObject,
);

type Records = Vec<(String, Vec<String>)>;

fn registry() -> &'static BrowserRegistry {
    REGISTRY.get_or_init(BrowserRegistry::default)
}

fn ns(text: &str) -> Retained<AnyObject> {
    let text = CString::new(text).expect("no nul");
    let made: Option<Retained<AnyObject>> =
        unsafe { msg_send![class!(NSString), stringWithUTF8String: text.as_ptr()] };
    made.expect("an NSString")
}

fn note(phase: &str, view: *mut AnyObject) {
    if view.is_null() {
        return;
    }
    let url: *mut AnyObject = unsafe { msg_send![view, URL] };
    let text = match url.is_null() {
        true => String::new(),
        false => {
            let absolute: *mut AnyObject = unsafe { msg_send![url, absoluteString] };
            text_of(absolute).unwrap_or_default()
        }
    };
    if phase != "failed" {
        remember_load(registry(), TAB, &text);
    }
    if let Ok(mut loads) = LOADS.lock() {
        loads.push((phase.to_string(), text));
    }
}

unsafe extern "C-unwind" fn did_commit(
    _this: *mut AnyObject,
    _cmd: Sel,
    view: *mut AnyObject,
    _navigation: *mut AnyObject,
) {
    note("started", view);
}

unsafe extern "C-unwind" fn did_finish(
    _this: *mut AnyObject,
    _cmd: Sel,
    view: *mut AnyObject,
    _navigation: *mut AnyObject,
) {
    note("finished", view);
}

unsafe extern "C-unwind" fn did_fail(
    _this: *mut AnyObject,
    _cmd: Sel,
    view: *mut AnyObject,
    _navigation: *mut AnyObject,
    _error: *mut AnyObject,
) {
    note("failed", view);
}

fn delegate_class() -> &'static AnyClass {
    static CLASS: OnceLock<&'static AnyClass> = OnceLock::new();
    CLASS.get_or_init(|| {
        let Some(mut builder) = ClassBuilder::new(DELEGATE_CLASS, class!(NSObject)) else {
            return AnyClass::get(DELEGATE_CLASS).expect("class exists");
        };
        let commit: NavigationFn = did_commit;
        let finish: NavigationFn = did_finish;
        let fail: FailFn = did_fail;
        unsafe {
            builder.add_method(sel!(webView:didCommitNavigation:), commit);
            builder.add_method(sel!(webView:didFinishNavigation:), finish);
            builder.add_method(sel!(webView:didFailProvisionalNavigation:withError:), fail);
            builder.add_method(sel!(webView:didFailNavigation:withError:), fail);
        }
        builder.register()
    })
}

fn spin_until(done: &dyn Fn() -> bool) -> bool {
    let start = Instant::now();
    while !done() {
        if start.elapsed() > STEP_LIMIT {
            return false;
        }
        autoreleasepool(|_| unsafe {
            let date: Retained<AnyObject> =
                msg_send![class!(NSDate), dateWithTimeIntervalSinceNow: 0.05f64];
            let run_loop: Retained<AnyObject> = msg_send![class!(NSRunLoop), currentRunLoop];
            let _: () = msg_send![&*run_loop, runUntilDate: &*date];
        });
    }
    true
}

struct Server {
    port_v4: u16,
    port_v6: u16,
    seen: Arc<Mutex<Vec<String>>>,
    stop: Arc<AtomicBool>,
    worker: Option<JoinHandle<()>>,
}

impl Drop for Server {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

fn reply(status: &str, extra: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html\r\n{extra}Content-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
}

fn page(port_v4: u16, port_v6: u16, path: &str) -> String {
    match path {
        "/hop" => reply(
            "302 Found",
            &format!("Location: http://127.0.0.1:{port_v4}/home\r\n"),
            "",
        ),
        "/home" => reply(
            "200 OK",
            "Set-Cookie: home=1; Path=/\r\n",
            &format!(
                "<html><body>home<iframe src=\"http://[::1]:{port_v6}/frame\"></iframe><script>localStorage.setItem('k','v');sessionStorage.setItem('s','v');indexedDB.open('probe');if(window.caches){{caches.open('probe').then(c=>c.put('/x',new Response('x')));}}document.cookie='seen=1; path=/';</script></body></html>"
            ),
        ),
        "/frame" | "/second" => reply(
            "200 OK",
            "Set-Cookie: frame=1; Path=/\r\n",
            "<html><body>frame<script>localStorage.setItem('f','1');</script></body></html>",
        ),
        _ => reply("404 Not Found", "", ""),
    }
}

fn answer(stream: TcpStream, port_v4: u16, port_v6: u16, seen: &Mutex<Vec<String>>) {
    let _ = stream.set_nonblocking(false);
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let Ok(reading) = stream.try_clone() else {
        return;
    };
    let mut reader = BufReader::new(reading);
    let mut first = String::new();
    if reader.read_line(&mut first).is_err() {
        return;
    }
    let mut line = String::new();
    while reader.read_line(&mut line).is_ok_and(|read| read > 2) {
        line.clear();
    }
    let path = first.split_whitespace().nth(1).unwrap_or("/").to_string();
    if let Ok(mut seen) = seen.lock() {
        seen.push(path.clone());
    }
    let mut stream = stream;
    let _ = stream.write_all(page(port_v4, port_v6, &path).as_bytes());
}

fn serve() -> Server {
    let v4 = TcpListener::bind("127.0.0.1:0").expect("bind v4");
    let v6 = TcpListener::bind("[::1]:0").expect("bind v6");
    let port_v4 = v4.local_addr().expect("addr").port();
    let port_v6 = v6.local_addr().expect("addr").port();
    v4.set_nonblocking(true).expect("nonblocking");
    v6.set_nonblocking(true).expect("nonblocking");
    let seen = Arc::new(Mutex::new(Vec::new()));
    let stop = Arc::new(AtomicBool::new(false));
    let worker = {
        let seen = seen.clone();
        let stop = stop.clone();
        thread::spawn(move || {
            while !stop.load(Ordering::SeqCst) {
                let mut is_idle = true;
                for listener in [&v4, &v6] {
                    if let Ok((stream, _)) = listener.accept() {
                        is_idle = false;
                        answer(stream, port_v4, port_v6, &seen);
                    }
                }
                if is_idle {
                    thread::sleep(Duration::from_millis(10));
                }
            }
        })
    };
    Server {
        port_v4,
        port_v6,
        seen,
        stop,
        worker: Some(worker),
    }
}

fn load(view: &AnyObject, address: &str) {
    unsafe {
        let url: Option<Retained<AnyObject>> =
            msg_send![class!(NSURL), URLWithString: &*ns(address)];
        let url = url.expect("a URL");
        let request: Retained<AnyObject> = msg_send![class!(NSURLRequest), requestWithURL: &*url];
        let _: *mut AnyObject = msg_send![view, loadRequest: &*request];
    }
}

fn has_finished(path: &str) -> bool {
    LOADS.lock().is_ok_and(|loads| {
        loads
            .iter()
            .any(|(phase, url)| phase == "finished" && url.ends_with(path))
    })
}

fn loads() -> Vec<(String, String)> {
    LOADS.lock().map(|loads| loads.clone()).unwrap_or_default()
}

fn set_cookies(store: &AnyObject) -> bool {
    let done = Rc::new(RefCell::new(0usize));
    unsafe {
        let cookies: Retained<AnyObject> = msg_send![store, httpCookieStore];
        for domain in PROBE_COOKIE_DOMAINS {
            let properties: Retained<AnyObject> = msg_send![class!(NSMutableDictionary), new];
            for (key, value) in [
                ("Domain", domain),
                ("Path", "/"),
                ("Name", "probe"),
                ("Value", "1"),
            ] {
                let _: () = msg_send![&*properties, setObject: &*ns(value), forKey: &*ns(key)];
            }
            let cookie: Option<Retained<AnyObject>> =
                msg_send![class!(NSHTTPCookie), cookieWithProperties: &*properties];
            let Some(cookie) = cookie else {
                *done.borrow_mut() += 1;
                continue;
            };
            let counter = done.clone();
            let block = RcBlock::new(move || {
                *counter.borrow_mut() += 1;
            });
            let _: () = msg_send![&*cookies, setCookie: &*cookie, completionHandler: &*block];
        }
    }
    spin_until(&|| *done.borrow() == PROBE_COOKIE_DOMAINS.len())
}

fn kinds_of(record: *mut AnyObject) -> Vec<String> {
    unsafe {
        let kinds: *mut AnyObject = msg_send![record, dataTypes];
        let all: *mut AnyObject = msg_send![kinds, allObjects];
        let count: usize = msg_send![all, count];
        let mut names: Vec<String> = (0..count)
            .filter_map(|at| text_of(msg_send![all, objectAtIndex: at]))
            .collect();
        names.sort();
        names
    }
}

fn records_of(store: &AnyObject) -> Records {
    let found: Rc<RefCell<Option<Records>>> = Rc::new(RefCell::new(None));
    let sink = found.clone();
    let handler = RcBlock::new(move |records: *mut AnyObject| {
        let total: usize = match records.is_null() {
            true => 0,
            false => unsafe { msg_send![records, count] },
        };
        let mut rows: Records = (0..total)
            .map(|index| {
                let record: *mut AnyObject = unsafe { msg_send![records, objectAtIndex: index] };
                let name: *mut AnyObject = unsafe { msg_send![record, displayName] };
                (text_of(name).unwrap_or_default(), kinds_of(record))
            })
            .collect();
        rows.sort();
        *sink.borrow_mut() = Some(rows);
    });
    unsafe {
        let types: Retained<AnyObject> = msg_send![class!(WKWebsiteDataStore), allWebsiteDataTypes];
        let _: () =
            msg_send![store, fetchDataRecordsOfTypes: &*types, completionHandler: &*handler];
    }
    assert!(spin_until(&|| found.borrow().is_some()), "records answered");
    let rows = found.borrow_mut().take().unwrap_or_default();
    rows
}

fn remove_store(identifier: &AnyObject) {
    let done = Rc::new(RefCell::new(false));
    let flag = done.clone();
    let block = RcBlock::new(move |_error: *mut AnyObject| {
        *flag.borrow_mut() = true;
    });
    unsafe {
        let _: () = msg_send![class!(WKWebsiteDataStore), removeDataStoreForIdentifier: identifier, completionHandler: &*block];
    }
    spin_until(&|| *done.borrow());
}

fn open_tab() {
    registry().insert(NewTab {
        id: TAB,
        session_id: "harborline",
        window_label: "main",
        profile: ProfileId::of_workspace("harborline").expect("workspace id"),
        url: "about:blank",
        rect: tauri::Rect {
            position: tauri::LogicalPosition::new(0.0, 0.0).into(),
            size: tauri::LogicalSize::new(1.0, 1.0).into(),
        },
        is_shown: true,
        opener_id: None,
        now_ms: 0,
    });
}

#[used]
#[link_section = "__DATA,__mod_init_func"]
static RUN_IN_CHILD: extern "C" fn() = run_in_child;

extern "C" fn run_in_child() {
    if std::env::var_os(PROBE_ENV).is_none() {
        return;
    }
    let code = match std::panic::catch_unwind(drive_webkit) {
        Ok(()) => 0,
        Err(_) => 1,
    };
    std::process::exit(code);
}

#[test]
#[ignore = "drives a real WKWebView: cargo test --lib site_data::tests::native -- --ignored --nocapture"]
fn a_tab_trail_keeps_main_frame_pages_and_the_store_names_its_records() {
    let mut command = std::process::Command::new(std::env::current_exe().expect("test binary"));
    command.env(PROBE_ENV, "1");
    let output =
        crate::proc::probe::run(command, Instant::now() + CHILD_LIMIT).expect("probe starts");
    println!("{}", output.stdout);
    assert!(!output.timed_out, "probe timed out\n{}", output.stderr);
    assert_eq!(output.code, Some(0), "{}", output.stderr);
}

fn drive_webkit() {
    assert_eq!(
        unsafe { pthread_main_np() },
        1,
        "WebKit needs the main thread"
    );
    let has_stores: Bool = unsafe {
        msg_send![class!(WKWebsiteDataStore), respondsToSelector: sel!(dataStoreForIdentifier:)]
    };
    if !has_stores.as_bool() {
        println!("probe skipped: no per-workspace stores before macOS 14");
        return;
    }
    let server = serve();
    open_tab();
    autoreleasepool(|_| unsafe {
        let app: Retained<AnyObject> = msg_send![class!(NSApplication), sharedApplication];
        let _: Bool = msg_send![&*app, setActivationPolicy: PROHIBITED_POLICY];
        let identifier: Retained<AnyObject> = msg_send![class!(NSUUID), UUID];
        let store: Retained<AnyObject> =
            msg_send![class!(WKWebsiteDataStore), dataStoreForIdentifier: &*identifier];
        let config: Retained<AnyObject> = msg_send![class!(WKWebViewConfiguration), new];
        let _: () = msg_send![&*config, setWebsiteDataStore: &*store];
        let frame = Rect {
            origin: Point { x: 0.0, y: 0.0 },
            size: Size {
                width: 320.0,
                height: 240.0,
            },
        };
        let allocated: Allocated<AnyObject> = msg_send![class!(WKWebView), alloc];
        let view: Retained<AnyObject> =
            msg_send![allocated, initWithFrame: frame, configuration: &*config];
        let delegate: Retained<AnyObject> = msg_send![delegate_class(), new];
        let _: () = msg_send![&*view, setNavigationDelegate: &*delegate];

        load(&view, &format!("http://localhost:{}/hop", server.port_v4));
        assert!(spin_until(&|| has_finished("/home")), "{:?}", loads());
        let has_frame = || {
            server
                .seen
                .lock()
                .is_ok_and(|seen| seen.iter().any(|path| path == "/frame"))
        };
        assert!(spin_until(&has_frame), "the iframe loaded");
        let settled = Instant::now();
        spin_until(&|| settled.elapsed() > SETTLE);
        assert_eq!(registry().trail_of(TAB), vec!["127.0.0.1"], "{:?}", loads());

        load(&view, &format!("http://[::1]:{}/second", server.port_v6));
        assert!(spin_until(&|| has_finished("/second")), "{:?}", loads());
        assert_eq!(registry().trail_of(TAB), vec!["127.0.0.1", "::1"]);

        assert!(set_cookies(&store), "cookies set");
        for (name, kinds) in records_of(&store) {
            println!("record {name:?} {kinds:?}");
        }
        println!("loads {:?}", loads());

        let _: () = msg_send![&*view, stopLoading];
        let _: () = msg_send![&*view, setNavigationDelegate: std::ptr::null::<AnyObject>()];
        drop(view);
        drop(delegate);
        drop(config);
        drop(store);
        remove_store(&identifier);
    });
    drop(server);
}
