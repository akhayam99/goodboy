use std::sync::Mutex;
use std::time::{Duration, Instant};

/// One-time pairing tokens. Minted at QR display, validated once at handshake
/// msg1, then burned. TTL mirrors PROTOCOL.md (~60 s from QR generation).
pub struct TokenStore {
    entries: Mutex<Vec<Entry>>,
    ttl: Duration,
}

struct Entry {
    token: Vec<u8>,
    expires_at: Instant,
}

impl TokenStore {
    pub fn new() -> Self {
        Self {
            entries: Mutex::new(Vec::new()),
            ttl: Duration::from_secs(60),
        }
    }

    /// Mints a fresh 256-bit single-use token and stores it with a TTL.
    pub fn mint(&self) -> Vec<u8> {
        use rand::RngCore;
        let mut token = vec![0u8; 32];
        rand::thread_rng().fill_bytes(&mut token);
        let mut guard = self.entries.lock().unwrap();
        guard.retain(|e| e.expires_at > Instant::now());
        guard.push(Entry {
            token: token.clone(),
            expires_at: Instant::now() + self.ttl,
        });
        token
    }

    /// Validates and burns a token: true iff present and unexpired. Single-use —
    /// a matching entry is removed so it can never be replayed.
    pub fn consume(&self, token: &[u8]) -> bool {
        let mut guard = self.entries.lock().unwrap();
        let now = Instant::now();
        guard.retain(|e| e.expires_at > now);
        if let Some(pos) = guard
            .iter()
            .position(|e| e.token.len() == token.len() && e.token == token)
        {
            guard.remove(pos);
            true
        } else {
            false
        }
    }
}

impl Default for TokenStore {
    fn default() -> Self {
        Self::new()
    }
}
