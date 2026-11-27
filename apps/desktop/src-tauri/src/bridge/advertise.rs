use super::network::RawAddress;

pub trait Advertiser: Send {
    fn advertise(&mut self, instance: &str, port: u16, interfaces: &[String])
        -> Result<(), String>;
    fn withdraw(&mut self);
}

pub fn system_advertiser() -> Box<dyn Advertiser> {
    #[cfg(target_os = "macos")]
    {
        Box::new(crate::platform::dns_sd::DnsSdAdvertiser::new())
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
    fn advertise(
        &mut self,
        _instance: &str,
        _port: u16,
        _interfaces: &[String],
    ) -> Result<(), String> {
        Ok(())
    }

    fn withdraw(&mut self) {}
}

pub fn fresh_instance_id() -> String {
    use rand::Rng;
    let mut bytes = [0u8; 8];
    rand::rng().fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn key_of(offered: &[RawAddress]) -> Vec<(String, String)> {
    let mut key: Vec<(String, String)> = offered
        .iter()
        .map(|a| (a.interface.clone(), a.ip.to_string()))
        .collect();
    key.sort();
    key
}

fn names_of(offered: &[RawAddress]) -> Vec<String> {
    let mut names: Vec<String> = offered.iter().map(|a| a.interface.clone()).collect();
    names.sort();
    names.dedup();
    names
}

pub struct Presence {
    advertiser: Box<dyn Advertiser>,
    instance: String,
    port: u16,
    offered: Vec<RawAddress>,
    is_up: bool,
}

impl Presence {
    pub fn start(
        advertiser: Box<dyn Advertiser>,
        instance: String,
        port: u16,
        offered: Vec<RawAddress>,
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

    pub fn tick(&mut self, offered: Vec<RawAddress>) -> bool {
        if key_of(&self.offered) == key_of(&offered) {
            return false;
        }
        self.sync(offered);
        true
    }

    pub fn stop(&mut self) {
        self.advertiser.withdraw();
        self.is_up = false;
    }

    fn sync(&mut self, offered: Vec<RawAddress>) {
        self.offered = offered;
        self.advertiser.withdraw();
        self.is_up = false;
        if self.offered.is_empty() || self.instance.is_empty() {
            return;
        }
        let interfaces = names_of(&self.offered);
        match self
            .advertiser
            .advertise(&self.instance, self.port, &interfaces)
        {
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
        fn advertise(
            &mut self,
            instance: &str,
            port: u16,
            interfaces: &[String],
        ) -> Result<(), String> {
            self.log
                .0
                .lock()
                .unwrap()
                .push(format!("up {instance} {port} {}", interfaces.join(",")));
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

    fn ips(list: &[&str]) -> Vec<RawAddress> {
        list.iter()
            .enumerate()
            .map(|(n, text)| RawAddress {
                interface: format!("en{n}"),
                ip: text.parse().unwrap(),
            })
            .collect()
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
        assert_eq!(ups(&log), ["up a1b2c3d4e5f60718 49160 en0"]);
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

    #[test]
    fn it_registers_on_each_private_interface_by_name_only() {
        let (advertiser, log) = recorder(false);

        let _presence = Presence::start(
            advertiser,
            "id".into(),
            7,
            ips(&["192.168.1.9", "100.64.0.5"]),
        );

        assert_eq!(ups(&log), ["up id 7 en0,en1"]);
    }

    #[test]
    fn the_instance_id_is_new_at_every_call_and_never_empty() {
        let one = fresh_instance_id();
        let two = fresh_instance_id();

        assert_eq!(one.len(), 16);
        assert_ne!(one, two);
    }

    #[test]
    fn an_empty_instance_is_never_advertised() {
        let (advertiser, log) = recorder(false);

        let presence = Presence::start(advertiser, String::new(), 7, ips(&["10.0.0.2"]));

        assert!(!presence.is_up());
        assert!(ups(&log).is_empty());
    }
}
