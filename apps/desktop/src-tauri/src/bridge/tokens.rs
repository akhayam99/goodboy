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

    #[cfg(test)]
    pub(super) fn with_ttl(ttl: Duration) -> Self {
        Self {
            entries: Mutex::new(Vec::new()),
            ttl,
        }
    }

    /// Mints a fresh 256-bit single-use token and stores it with a TTL.
    pub fn mint(&self) -> Vec<u8> {
        use rand::RngCore;
        let mut token = vec![0u8; 32];
        rand::rng().fill_bytes(&mut token);
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn minted_tokens_are_256_bit_and_never_repeat() {
        let store = TokenStore::new();

        let tokens: Vec<Vec<u8>> = (0..64).map(|_| store.mint()).collect();

        assert!(tokens.iter().all(|token| token.len() == 32));
        let unique: std::collections::HashSet<&Vec<u8>> = tokens.iter().collect();
        assert_eq!(unique.len(), tokens.len());
    }

    #[test]
    fn a_minted_token_is_accepted_once_and_then_burned() {
        let store = TokenStore::new();
        let token = store.mint();

        assert!(store.consume(&token));
        assert!(!store.consume(&token));
    }

    #[test]
    fn a_token_that_was_never_minted_is_refused() {
        let store = TokenStore::new();
        store.mint();

        assert!(!store.consume(&[7u8; 32]));
        assert!(!store.consume(&[]));
    }

    #[test]
    fn a_token_is_only_accepted_in_full() {
        let store = TokenStore::new();
        let token = store.mint();

        assert!(!store.consume(&token[..31]));
        let mut longer = token.clone();
        longer.push(0);
        assert!(!store.consume(&longer));
        assert!(store.consume(&token));
    }

    #[test]
    fn burning_one_token_leaves_the_others_valid() {
        let store = TokenStore::new();
        let first = store.mint();
        let second = store.mint();

        assert!(store.consume(&first));
        assert!(store.consume(&second));
    }

    #[test]
    fn an_expired_token_is_refused() {
        let store = TokenStore::with_ttl(Duration::ZERO);
        let token = store.mint();

        assert!(!store.consume(&token));
    }

    #[test]
    fn a_token_is_accepted_inside_its_ttl_and_refused_after_it() {
        let store = TokenStore::with_ttl(Duration::from_millis(100));
        let inside = store.mint();
        let outside = store.mint();

        assert!(store.consume(&inside));
        std::thread::sleep(Duration::from_millis(200));

        assert!(!store.consume(&outside));
    }

    #[test]
    fn every_token_minted_past_its_ttl_is_refused() {
        let store = TokenStore::with_ttl(Duration::ZERO);
        let tokens = [store.mint(), store.mint(), store.mint()];

        assert!(tokens.iter().all(|token| !store.consume(token)));
    }
}
