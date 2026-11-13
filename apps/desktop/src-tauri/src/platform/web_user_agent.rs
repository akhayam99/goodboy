#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum DevicePreset {
    Desktop,
    Tablet,
    Phone,
}

pub(crate) const DESKTOP_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const TABLET_AGENT: &str = "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const PHONE_AGENT: &str = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

impl DevicePreset {
    pub(crate) fn named(name: &str) -> Option<Self> {
        match name {
            "desktop" => Some(Self::Desktop),
            "tablet" => Some(Self::Tablet),
            "phone" => Some(Self::Phone),
            _ => None,
        }
    }

    pub(crate) fn user_agent(self) -> &'static str {
        match self {
            Self::Desktop => DESKTOP_AGENT,
            Self::Tablet => TABLET_AGENT,
            Self::Phone => PHONE_AGENT,
        }
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn set_live_wk_web_view_user_agent(
    platform: tauri::webview::PlatformWebview,
    preset: DevicePreset,
) {
    use objc2::runtime::AnyObject;
    use objc2::{class, msg_send};
    let Ok(text) = std::ffi::CString::new(preset.user_agent()) else {
        return;
    };
    let view = platform.inner().cast::<AnyObject>();
    let value: *mut AnyObject =
        unsafe { msg_send![class!(NSString), stringWithUTF8String: text.as_ptr()] };
    if value.is_null() {
        return;
    }
    let _: () = unsafe { msg_send![view, setCustomUserAgent: value] };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_each_preset() {
        assert_eq!(DevicePreset::named("desktop"), Some(DevicePreset::Desktop));
        assert_eq!(DevicePreset::named("tablet"), Some(DevicePreset::Tablet));
        assert_eq!(DevicePreset::named("phone"), Some(DevicePreset::Phone));
        assert_eq!(DevicePreset::named("watch"), None);
        assert_eq!(DevicePreset::named(""), None);
    }

    #[test]
    fn pins_the_agent_string_per_preset() {
        assert_eq!(
            DevicePreset::Desktop.user_agent(),
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15"
        );
        assert_eq!(
            DevicePreset::Tablet.user_agent(),
            "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
        );
        assert_eq!(
            DevicePreset::Phone.user_agent(),
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
        );
    }
}
