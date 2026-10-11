use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde::Serialize;

pub const RING_CAP: usize = 262_144;
pub const EXITED_RETENTION: Duration = Duration::from_secs(600);

pub struct OutputRing {
    bytes: VecDeque<u8>,
    cap: usize,
    total: u64,
}

impl OutputRing {
    pub fn new() -> Self {
        Self::with_cap(RING_CAP)
    }

    pub fn with_cap(cap: usize) -> Self {
        Self {
            bytes: VecDeque::new(),
            cap,
            total: 0,
        }
    }

    pub fn push(&mut self, chunk: &[u8]) -> u64 {
        let start = self.total;
        self.total += chunk.len() as u64;
        let kept = &chunk[chunk.len().saturating_sub(self.cap)..];
        self.bytes.extend(kept.iter().copied());
        let overflow = self.bytes.len().saturating_sub(self.cap);
        self.bytes.drain(..overflow);
        start
    }

    pub fn snapshot(&self) -> (Vec<u8>, u64) {
        let offset = self.total - self.bytes.len() as u64;
        (self.bytes.iter().copied().collect(), offset)
    }
}

impl Default for OutputRing {
    fn default() -> Self {
        Self::new()
    }
}

pub type SharedRing = Arc<Mutex<OutputRing>>;

pub fn new_shared_ring() -> SharedRing {
    Arc::new(Mutex::new(OutputRing::new()))
}

pub fn push_shared(ring: &SharedRing, chunk: &[u8]) -> u64 {
    let mut guard = ring.lock().unwrap_or_else(|error| error.into_inner());
    guard.push(chunk)
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OutputSnapshot {
    pub data: String,
    pub offset: u64,
    pub exit_code: Option<i32>,
}

pub fn snapshot_of(ring: &SharedRing, exit_code: Option<i32>) -> OutputSnapshot {
    let guard = ring.lock().unwrap_or_else(|error| error.into_inner());
    let (bytes, offset) = guard.snapshot();
    OutputSnapshot {
        data: STANDARD.encode(bytes),
        offset,
        exit_code,
    }
}

struct ExitedRing {
    ring: SharedRing,
    exit_code: i32,
    exited_at: Instant,
}

pub struct ExitedStore {
    map: Mutex<HashMap<String, ExitedRing>>,
    retention: Duration,
}

impl Default for ExitedStore {
    fn default() -> Self {
        Self::with_retention(EXITED_RETENTION)
    }
}

impl ExitedStore {
    pub fn with_retention(retention: Duration) -> Self {
        Self {
            map: Mutex::new(HashMap::new()),
            retention,
        }
    }

    pub fn keep(&self, id: &str, ring: SharedRing, exit_code: i32) {
        let mut map = self.map.lock().unwrap_or_else(|error| error.into_inner());
        map.retain(|_, entry| entry.exited_at.elapsed() < self.retention);
        map.insert(
            id.to_string(),
            ExitedRing {
                ring,
                exit_code,
                exited_at: Instant::now(),
            },
        );
    }

    pub fn snapshot(&self, id: &str) -> Option<OutputSnapshot> {
        let mut map = self.map.lock().unwrap_or_else(|error| error.into_inner());
        map.retain(|_, entry| entry.exited_at.elapsed() < self.retention);
        let entry = map.get(id)?;
        Some(snapshot_of(&entry.ring, Some(entry.exit_code)))
    }

    pub fn forget(&self, id: &str) {
        let mut map = self.map.lock().unwrap_or_else(|error| error.into_inner());
        map.remove(id);
    }
}

pub fn empty_snapshot() -> OutputSnapshot {
    OutputSnapshot {
        data: String::new(),
        offset: 0,
        exit_code: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_exactly_the_last_cap_bytes_after_a_megabyte() {
        let mut ring = OutputRing::new();
        let chunk = vec![b'a'; 4096];
        for index in 0..256 {
            let mut marked = chunk.clone();
            marked[0] = (index % 251) as u8;
            ring.push(&marked);
        }
        let (bytes, offset) = ring.snapshot();
        assert_eq!(bytes.len(), RING_CAP);
        assert_eq!(offset, 1_048_576 - RING_CAP as u64);
    }

    #[test]
    fn push_returns_the_running_offset_of_the_chunk_start() {
        let mut ring = OutputRing::with_cap(8);
        assert_eq!(ring.push(b"abcd"), 0);
        assert_eq!(ring.push(b"efgh"), 4);
        assert_eq!(ring.push(b"ij"), 8);
        let (bytes, offset) = ring.snapshot();
        assert_eq!(bytes, b"cdefghij");
        assert_eq!(offset, 2);
    }

    #[test]
    fn a_chunk_larger_than_the_cap_keeps_its_tail() {
        let mut ring = OutputRing::with_cap(4);
        ring.push(b"0123456789");
        let (bytes, offset) = ring.snapshot();
        assert_eq!(bytes, b"6789");
        assert_eq!(offset, 6);
    }

    #[test]
    fn an_empty_ring_snapshots_to_nothing_at_offset_zero() {
        let (bytes, offset) = OutputRing::new().snapshot();
        assert!(bytes.is_empty());
        assert_eq!(offset, 0);
    }

    #[test]
    fn exited_store_serves_the_ring_with_its_exit_code() {
        let store = ExitedStore::default();
        let ring = new_shared_ring();
        push_shared(&ring, b"done\n");
        store.keep("run-1", ring, 3);
        let snapshot = store.snapshot("run-1").expect("kept");
        assert_eq!(snapshot.exit_code, Some(3));
        assert_eq!(STANDARD.decode(snapshot.data).unwrap(), b"done\n");
        assert!(store.snapshot("run-2").is_none());
    }

    #[test]
    fn exited_store_drops_a_ring_past_the_retention() {
        let store = ExitedStore::with_retention(Duration::ZERO);
        store.keep("old", new_shared_ring(), 0);
        assert!(store.snapshot("old").is_none());
    }
}
