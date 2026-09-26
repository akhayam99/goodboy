#[cfg(target_os = "macos")]
fn macos_preferred_scroller_style() -> String {
    use objc2::{class, msg_send};
    let style: isize = unsafe { msg_send![class!(NSScroller), preferredScrollerStyle] };
    if style == 0 {
        "always".to_string()
    } else {
        "hover".to_string()
    }
}

#[tauri::command]
pub fn system_scroller_style() -> String {
    #[cfg(target_os = "macos")]
    {
        macos_preferred_scroller_style()
    }
    #[cfg(not(target_os = "macos"))]
    {
        "hover".to_string()
    }
}
