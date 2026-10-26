use std::collections::HashSet;
use std::net::IpAddr;
use std::sync::{Arc, Mutex};

use tokio::sync::{OwnedSemaphorePermit, Semaphore};

pub const MAX_UNAUTHENTICATED: usize = 8;

pub struct HandshakeGate {
    slots: Arc<Semaphore>,
    peers: Arc<Mutex<HashSet<IpAddr>>>,
}

pub struct HandshakePermit {
    _slot: OwnedSemaphorePermit,
    peers: Arc<Mutex<HashSet<IpAddr>>>,
    ip: IpAddr,
}

impl HandshakeGate {
    pub fn new(max: usize) -> Self {
        Self {
            slots: Arc::new(Semaphore::new(max)),
            peers: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    pub fn try_enter(&self, ip: IpAddr) -> Option<HandshakePermit> {
        let mut peers = self.peers.lock().ok()?;
        if peers.contains(&ip) {
            return None;
        }
        let slot = self.slots.clone().try_acquire_owned().ok()?;
        peers.insert(ip);
        Some(HandshakePermit {
            _slot: slot,
            peers: self.peers.clone(),
            ip,
        })
    }
}

impl Drop for HandshakePermit {
    fn drop(&mut self) {
        if let Ok(mut peers) = self.peers.lock() {
            peers.remove(&self.ip);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ip(last: u8) -> IpAddr {
        IpAddr::from([192, 168, 1, last])
    }

    #[test]
    fn a_second_unauthenticated_connection_from_one_address_is_refused() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);

        let first = gate.try_enter(ip(1));

        assert!(first.is_some());
        assert!(gate.try_enter(ip(1)).is_none());
    }

    #[test]
    fn an_unauthenticated_connection_past_the_cap_connection_is_refused() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        let held: Vec<_> = (0..MAX_UNAUTHENTICATED as u8)
            .map(|n| gate.try_enter(ip(n)))
            .collect();

        assert!(held.iter().all(Option::is_some));
        assert!(gate.try_enter(ip(200)).is_none());
    }

    #[test]
    fn finishing_the_handshake_frees_the_slot_and_the_address() {
        let gate = HandshakeGate::new(1);
        let permit = gate.try_enter(ip(1)).unwrap();

        drop(permit);

        assert!(gate.try_enter(ip(1)).is_some());
    }
}
