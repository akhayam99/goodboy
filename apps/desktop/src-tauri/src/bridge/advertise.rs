use std::net::IpAddr;

use super::listen::same_ips;

pub trait Advertiser: Send {
    fn advertise(&mut self, instance: &str, port: u16) -> Result<(), String>;
    fn withdraw(&mut self);
}

pub fn system_advertiser() -> Box<dyn Advertiser> {
    #[cfg(target_os = "macos")]
    {
        Box::new(dns_sd::DnsSdAdvertiser::new())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Box::new(Silent)
    }
}

#[cfg(not(target_os = "macos"))]
struct Silent;

#[cfg(not(target_os = "macos"))]
impl Advertiser for Silent {
    fn advertise(&mut self, _instance: &str, _port: u16) -> Result<(), String> {
        Ok(())
    }

    fn withdraw(&mut self) {}
}

#[cfg(target_os = "macos")]
mod dns_sd {
    use std::ffi::{c_char, c_void, CString};

    use super::Advertiser;
    use crate::bridge::SERVICE_NAME;

    type Reference = *mut c_void;

    type Callback = Option<
        unsafe extern "C" fn(
            Reference,
            u32,
            i32,
            *const c_char,
            *const c_char,
            *const c_char,
            *mut c_void,
        ),
    >;

    extern "C" {
        fn DNSServiceRegister(
            reference: *mut Reference,
            flags: u32,
            interface_index: u32,
            name: *const c_char,
            service_type: *const c_char,
            domain: *const c_char,
            host: *const c_char,
            port: u16,
            txt_len: u16,
            txt: *const c_void,
            callback: Callback,
            context: *mut c_void,
        ) -> i32;
        fn DNSServiceRefDeallocate(reference: Reference);
    }

    struct Registration(Reference);

    unsafe impl Send for Registration {}

    pub struct DnsSdAdvertiser {
        registration: Option<Registration>,
    }

    impl DnsSdAdvertiser {
        pub fn new() -> Self {
            Self { registration: None }
        }
    }

    impl Advertiser for DnsSdAdvertiser {
        fn advertise(&mut self, instance: &str, port: u16) -> Result<(), String> {
            self.withdraw();
            let name = CString::new(instance).map_err(|e| e.to_string())?;
            let service_type = CString::new(SERVICE_NAME).map_err(|e| e.to_string())?;
            let mut reference: Reference = std::ptr::null_mut();
            let code = unsafe {
                DNSServiceRegister(
                    &mut reference,
                    0,
                    0,
                    name.as_ptr(),
                    service_type.as_ptr(),
                    std::ptr::null(),
                    std::ptr::null(),
                    port.to_be(),
                    0,
                    std::ptr::null(),
                    None,
                    std::ptr::null_mut(),
                )
            };
            if code != 0 || reference.is_null() {
                return Err(format!("dns-sd register failed with code {code}"));
            }
            self.registration = Some(Registration(reference));
            Ok(())
        }

        fn withdraw(&mut self) {
            if let Some(Registration(reference)) = self.registration.take() {
                unsafe { DNSServiceRefDeallocate(reference) };
            }
        }
    }

    impl Drop for DnsSdAdvertiser {
        fn drop(&mut self) {
            self.withdraw();
        }
    }
}

pub struct Presence {
    advertiser: Box<dyn Advertiser>,
    instance: String,
    port: u16,
    offered: Vec<IpAddr>,
    is_up: bool,
}

impl Presence {
    pub fn start(
        advertiser: Box<dyn Advertiser>,
        instance: String,
        port: u16,
        offered: Vec<IpAddr>,
    ) -> Self {
        let mut presence = Self {
            advertiser,
            instance,
            port,
            offered: Vec::new(),
            is_up: false,
        };
        presence.sync(offered);
        presence
    }

    pub fn is_up(&self) -> bool {
        self.is_up
    }

    pub fn tick(&mut self, offered: Vec<IpAddr>) -> bool {
        if same_ips(&self.offered, &offered) {
            return false;
        }
        self.sync(offered);
        true
    }

    pub fn stop(&mut self) {
        self.advertiser.withdraw();
        self.is_up = false;
    }

    fn sync(&mut self, offered: Vec<IpAddr>) {
        self.offered = offered;
        self.advertiser.withdraw();
        self.is_up = false;
        if self.offered.is_empty() {
            return;
        }
        match self.advertiser.advertise(&self.instance, self.port) {
            Ok(()) => self.is_up = true,
            Err(error) => log::warn!("[bridge] bonjour advertise failed: {error}"),
        }
    }
}

impl Drop for Presence {
    fn drop(&mut self) {
        self.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    #[derive(Clone, Default)]
    struct Log(Arc<Mutex<Vec<String>>>);

    impl Log {
        fn lines(&self) -> Vec<String> {
            self.0.lock().unwrap().clone()
        }
    }

    struct Recorder {
        log: Log,
        is_failing: bool,
    }

    impl Advertiser for Recorder {
        fn advertise(&mut self, instance: &str, port: u16) -> Result<(), String> {
            self.log
                .0
                .lock()
                .unwrap()
                .push(format!("up {instance} {port}"));
            match self.is_failing {
                true => Err("responder down".into()),
                false => Ok(()),
            }
        }

        fn withdraw(&mut self) {
            self.log.0.lock().unwrap().push("down".into());
        }
    }

    fn recorder(is_failing: bool) -> (Box<dyn Advertiser>, Log) {
        let log = Log::default();
        (
            Box::new(Recorder {
                log: log.clone(),
                is_failing,
            }),
            log,
        )
    }

    fn ips(list: &[&str]) -> Vec<IpAddr> {
        list.iter().map(|text| text.parse().unwrap()).collect()
    }

    fn ups(log: &Log) -> Vec<String> {
        log.lines()
            .into_iter()
            .filter(|l| l.starts_with("up"))
            .collect()
    }

    #[test]
    fn starting_advertises_the_opaque_instance_on_the_port() {
        let (advertiser, log) = recorder(false);

        let presence = Presence::start(
            advertiser,
            "a1b2c3d4e5f60718".into(),
            49160,
            ips(&["192.168.1.20"]),
        );

        assert!(presence.is_up());
        assert_eq!(ups(&log), ["up a1b2c3d4e5f60718 49160"]);
    }

    #[test]
    fn stopping_and_dropping_withdraw_the_advertisement() {
        let (advertiser, log) = recorder(false);
        let mut presence = Presence::start(advertiser, "id".into(), 1, ips(&["10.0.0.2"]));

        presence.stop();
        assert!(!presence.is_up());
        let downs_after_stop = log.lines().iter().filter(|l| *l == "down").count();
        drop(presence);

        assert!(downs_after_stop >= 1);
        assert_eq!(log.lines().last().map(String::as_str), Some("down"));
    }

    #[test]
    fn an_interface_change_advertises_again_and_the_same_set_does_not() {
        let (advertiser, log) = recorder(false);
        let mut presence = Presence::start(advertiser, "id".into(), 7, ips(&["10.0.0.2"]));

        assert!(!presence.tick(ips(&["10.0.0.2"])));
        assert!(presence.tick(ips(&["10.0.0.2", "192.168.1.9"])));

        assert_eq!(ups(&log).len(), 2);
    }

    #[test]
    fn losing_every_private_address_withdraws_and_a_return_advertises() {
        let (advertiser, log) = recorder(false);
        let mut presence = Presence::start(advertiser, "id".into(), 7, ips(&["10.0.0.2"]));

        presence.tick(Vec::new());
        assert!(!presence.is_up());
        presence.tick(ips(&["10.0.0.3"]));

        assert!(presence.is_up());
        assert_eq!(ups(&log).len(), 2);
    }

    #[test]
    fn a_failing_responder_never_takes_the_listener_down() {
        let (advertiser, _log) = recorder(true);

        let presence = Presence::start(advertiser, "id".into(), 7, ips(&["10.0.0.2"]));

        assert!(!presence.is_up());
    }

    #[test]
    fn the_service_type_is_the_one_the_phone_browses() {
        assert_eq!(crate::bridge::SERVICE_NAME, "_goodboy._tcp");
    }
}
