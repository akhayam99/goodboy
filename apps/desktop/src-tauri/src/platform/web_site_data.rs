use std::ffi::{c_char, CStr};
use std::sync::mpsc::SyncSender;

use block2::RcBlock;
use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2::{class, msg_send};

pub(crate) fn reload_from_origin(platform: tauri::webview::PlatformWebview) {
    let view = platform.inner().cast::<AnyObject>();
    if view.is_null() {
        return;
    }
    let _: *mut AnyObject = unsafe { msg_send![view, reloadFromOrigin] };
}

fn text_of(name: *mut AnyObject) -> Option<String> {
    if name.is_null() {
        return None;
    }
    let utf8: *const c_char = unsafe { msg_send![name, UTF8String] };
    if utf8.is_null() {
        return None;
    }
    Some(
        unsafe { CStr::from_ptr(utf8) }
            .to_string_lossy()
            .into_owned(),
    )
}

fn store_of(view: *mut AnyObject) -> Option<Retained<AnyObject>> {
    let config: Option<Retained<AnyObject>> = unsafe { msg_send![view, configuration] };
    let config = config?;
    unsafe { msg_send![&*config, websiteDataStore] }
}

fn chosen_records<Keep>(
    records: *mut AnyObject,
    keep: &Keep,
) -> Option<(Retained<AnyObject>, usize)>
where
    Keep: Fn(&str) -> bool,
{
    let chosen: Option<Retained<AnyObject>> = unsafe { msg_send![class!(NSMutableArray), array] };
    let chosen = chosen?;
    if records.is_null() {
        return Some((chosen, 0));
    }
    let total: usize = unsafe { msg_send![records, count] };
    let mut count = 0;
    for index in 0..total {
        let record: *mut AnyObject = unsafe { msg_send![records, objectAtIndex: index] };
        if record.is_null() {
            continue;
        }
        let name: *mut AnyObject = unsafe { msg_send![record, displayName] };
        if !text_of(name).is_some_and(|name| keep(&name)) {
            continue;
        }
        let _: () = unsafe { msg_send![&*chosen, addObject: record] };
        count += 1;
    }
    Some((chosen, count))
}

fn remove_chosen<Keep>(
    store: &AnyObject,
    types: &AnyObject,
    records: *mut AnyObject,
    keep: &Keep,
    sender: SyncSender<Option<usize>>,
) where
    Keep: Fn(&str) -> bool,
{
    let Some((chosen, count)) = chosen_records(records, keep) else {
        let _ = sender.try_send(None);
        return;
    };
    if count == 0 {
        let _ = sender.try_send(Some(0));
        return;
    }
    let done = RcBlock::new(move || {
        let _ = sender.try_send(Some(count));
    });
    let _: () = unsafe {
        msg_send![store, removeDataOfTypes: types, forDataRecords: &*chosen, completionHandler: &*done]
    };
}

pub(crate) fn remove_records<Keep>(
    platform: tauri::webview::PlatformWebview,
    keep: Keep,
    sender: SyncSender<Option<usize>>,
) where
    Keep: Fn(&str) -> bool + 'static,
{
    let view = platform.inner().cast::<AnyObject>();
    if view.is_null() {
        let _ = sender.try_send(None);
        return;
    }
    let Some(store) = store_of(view) else {
        let _ = sender.try_send(None);
        return;
    };
    let types: Option<Retained<AnyObject>> =
        unsafe { msg_send![class!(WKWebsiteDataStore), allWebsiteDataTypes] };
    let Some(types) = types else {
        let _ = sender.try_send(None);
        return;
    };
    let held_store = store.clone();
    let held_types = types.clone();
    let handler = RcBlock::new(move |records: *mut AnyObject| {
        remove_chosen(&held_store, &held_types, records, &keep, sender.clone());
    });
    let _: () = unsafe {
        msg_send![&*store, fetchDataRecordsOfTypes: &*types, completionHandler: &*handler]
    };
}
