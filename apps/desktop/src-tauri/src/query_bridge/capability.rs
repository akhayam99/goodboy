#![allow(dead_code)]

use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) const CAPABILITY_VERBS: &[&str] = &[
    "agent delegate",
    "agent status",
    "agent answer",
    "agent finish",
    "agent request-status",
];

pub(crate) const CAPABILITY_TTL_MS: u64 = 60 * 60 * 1000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CapabilityGrant {
    pub(crate) agent_id: String,
    pub(crate) tree_id: String,
    pub(crate) generation: u64,
    pub(crate) workspace_id: String,
    pub(crate) session_id: String,
    pub(crate) run_id: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct LiveTree<'a> {
    pub(crate) tree_id: &'a str,
    pub(crate) generation: u64,
    pub(crate) active_run_id: &'a str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CapabilityRefusal {
    MissingToken,
    UnknownToken,
    Revoked,
    Expired,
    VerbNotPermitted,
    WrongTree,
    StaleGeneration,
    WrongRun,
}

#[derive(Debug, Clone)]
struct CapabilityRecord {
    grant: CapabilityGrant,
    expires_at_ms: u64,
    is_revoked: bool,
}

#[derive(Debug, Default)]
pub(crate) struct CapabilityRegistry {
    records: Mutex<HashMap<String, CapabilityRecord>>,
}

fn new_token() -> String {
    format!(
        "{:032x}{:032x}",
        rand::random::<u128>(),
        rand::random::<u128>()
    )
}

pub(crate) fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or_default()
}

impl CapabilityRegistry {
    fn lock(&self) -> MutexGuard<'_, HashMap<String, CapabilityRecord>> {
        self.records
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub(crate) fn mint(&self, grant: CapabilityGrant, now_ms: u64) -> String {
        let token = new_token();
        let mut records = self.lock();
        records.retain(|_, record| record.expires_at_ms > now_ms);
        records.insert(
            token.clone(),
            CapabilityRecord {
                grant,
                expires_at_ms: now_ms.saturating_add(CAPABILITY_TTL_MS),
                is_revoked: false,
            },
        );
        token
    }

    pub(crate) fn authorize(
        &self,
        token: Option<&str>,
        verb: &str,
        live: LiveTree<'_>,
        now_ms: u64,
    ) -> Result<CapabilityGrant, CapabilityRefusal> {
        let token = token
            .filter(|value| !value.is_empty())
            .ok_or(CapabilityRefusal::MissingToken)?;
        let records = self.lock();
        let record = records.get(token).ok_or(CapabilityRefusal::UnknownToken)?;
        if record.is_revoked {
            return Err(CapabilityRefusal::Revoked);
        }
        if record.expires_at_ms <= now_ms {
            return Err(CapabilityRefusal::Expired);
        }
        if !CAPABILITY_VERBS.contains(&verb) {
            return Err(CapabilityRefusal::VerbNotPermitted);
        }
        if record.grant.tree_id != live.tree_id {
            return Err(CapabilityRefusal::WrongTree);
        }
        if record.grant.generation != live.generation {
            return Err(CapabilityRefusal::StaleGeneration);
        }
        if record.grant.run_id != live.active_run_id {
            return Err(CapabilityRefusal::WrongRun);
        }
        Ok(record.grant.clone())
    }

    pub(crate) fn revoke_turn(&self, token: &str) -> bool {
        let mut records = self.lock();
        match records.get_mut(token) {
            Some(record) => {
                record.is_revoked = true;
                true
            }
            None => false,
        }
    }

    pub(crate) fn revoke_tree(&self, tree_id: &str) -> usize {
        self.revoke_where(|grant| grant.tree_id == tree_id)
    }

    pub(crate) fn revoke_before_generation(&self, tree_id: &str, generation: u64) -> usize {
        self.revoke_where(|grant| grant.tree_id == tree_id && grant.generation < generation)
    }

    fn revoke_where(&self, matches: impl Fn(&CapabilityGrant) -> bool) -> usize {
        let mut records = self.lock();
        let mut revoked = 0;
        for record in records.values_mut() {
            if !record.is_revoked && matches(&record.grant) {
                record.is_revoked = true;
                revoked += 1;
            }
        }
        revoked
    }
}

static REGISTRY: OnceLock<CapabilityRegistry> = OnceLock::new();

pub(crate) fn registry() -> &'static CapabilityRegistry {
    REGISTRY.get_or_init(CapabilityRegistry::default)
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: u64 = 1_000_000;

    fn grant() -> CapabilityGrant {
        CapabilityGrant {
            agent_id: "agent-harborline".to_string(),
            tree_id: "tree-1".to_string(),
            generation: 3,
            workspace_id: "workspace-northwind".to_string(),
            session_id: "session-acme".to_string(),
            run_id: "run-7".to_string(),
        }
    }

    fn live() -> LiveTree<'static> {
        LiveTree {
            tree_id: "tree-1",
            generation: 3,
            active_run_id: "run-7",
        }
    }

    fn minted() -> (CapabilityRegistry, String) {
        let registry = CapabilityRegistry::default();
        let token = registry.mint(grant(), NOW);
        (registry, token)
    }

    #[test]
    fn a_minted_token_grants_every_permitted_verb_on_the_live_turn() {
        let (registry, token) = minted();

        for verb in CAPABILITY_VERBS {
            assert_eq!(
                registry.authorize(Some(&token), verb, live(), NOW + 1),
                Ok(grant())
            );
        }
    }

    #[test]
    fn every_token_is_long_random_and_different() {
        let registry = CapabilityRegistry::default();

        let first = registry.mint(grant(), NOW);
        let second = registry.mint(grant(), NOW);

        assert_eq!(first.len(), 64);
        assert!(first.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(first, second);
    }

    #[test]
    fn a_call_with_no_token_is_refused() {
        let (registry, _) = minted();

        assert_eq!(
            registry.authorize(None, "agent delegate", live(), NOW),
            Err(CapabilityRefusal::MissingToken)
        );
        assert_eq!(
            registry.authorize(Some(""), "agent delegate", live(), NOW),
            Err(CapabilityRefusal::MissingToken)
        );
    }

    #[test]
    fn a_forged_token_is_refused() {
        let (registry, token) = minted();
        let forged = format!("{}0", &token[..63]);

        assert_eq!(
            registry.authorize(Some(&forged), "agent delegate", live(), NOW),
            Err(CapabilityRefusal::UnknownToken)
        );
        assert_eq!(
            registry.authorize(Some("agent-harborline"), "agent delegate", live(), NOW),
            Err(CapabilityRefusal::UnknownToken)
        );
    }

    #[test]
    fn a_verb_outside_the_closed_set_is_refused() {
        let (registry, token) = minted();

        for verb in [
            "mount fork",
            "mount write",
            "project list",
            "agent",
            "agent delegate ",
        ] {
            assert_eq!(
                registry.authorize(Some(&token), verb, live(), NOW),
                Err(CapabilityRefusal::VerbNotPermitted),
                "{verb}"
            );
        }
    }

    #[test]
    fn a_token_is_refused_after_its_turn_ends() {
        let (registry, token) = minted();

        assert!(registry.revoke_turn(&token));

        assert_eq!(
            registry.authorize(Some(&token), "agent status", live(), NOW),
            Err(CapabilityRefusal::Revoked)
        );
        assert!(!registry.revoke_turn("not-a-token"));
    }

    #[test]
    fn a_token_is_refused_after_its_expiry() {
        let (registry, token) = minted();

        assert!(registry
            .authorize(
                Some(&token),
                "agent status",
                live(),
                NOW + CAPABILITY_TTL_MS - 1
            )
            .is_ok());
        assert_eq!(
            registry.authorize(
                Some(&token),
                "agent status",
                live(),
                NOW + CAPABILITY_TTL_MS
            ),
            Err(CapabilityRefusal::Expired)
        );
    }

    #[test]
    fn minting_drops_the_records_that_expired() {
        let registry = CapabilityRegistry::default();
        let old = registry.mint(grant(), NOW);

        registry.mint(grant(), NOW + CAPABILITY_TTL_MS + 1);

        assert_eq!(
            registry.authorize(
                Some(&old),
                "agent status",
                live(),
                NOW + CAPABILITY_TTL_MS + 1
            ),
            Err(CapabilityRefusal::UnknownToken)
        );
    }

    #[test]
    fn a_stop_revokes_every_token_of_the_tree_and_no_other() {
        let registry = CapabilityRegistry::default();
        let first = registry.mint(grant(), NOW);
        let second = registry.mint(grant(), NOW);
        let other_tree = CapabilityGrant {
            tree_id: "tree-2".to_string(),
            ..grant()
        };
        let kept = registry.mint(other_tree, NOW);

        assert_eq!(registry.revoke_tree("tree-1"), 2);

        for token in [&first, &second] {
            assert_eq!(
                registry.authorize(Some(token), "agent status", live(), NOW),
                Err(CapabilityRefusal::Revoked)
            );
        }
        let other_live = LiveTree {
            tree_id: "tree-2",
            ..live()
        };
        assert!(registry
            .authorize(Some(&kept), "agent status", other_live, NOW)
            .is_ok());
        assert_eq!(registry.revoke_tree("tree-1"), 0);
    }

    #[test]
    fn a_new_generation_revokes_the_older_tokens_only() {
        let registry = CapabilityRegistry::default();
        let older = registry.mint(grant(), NOW);
        let current_grant = CapabilityGrant {
            generation: 4,
            ..grant()
        };
        let current = registry.mint(current_grant, NOW);

        assert_eq!(registry.revoke_before_generation("tree-1", 4), 1);

        assert_eq!(
            registry.authorize(Some(&older), "agent status", live(), NOW),
            Err(CapabilityRefusal::Revoked)
        );
        let next_live = LiveTree {
            generation: 4,
            ..live()
        };
        assert!(registry
            .authorize(Some(&current), "agent status", next_live, NOW)
            .is_ok());
    }

    #[test]
    fn a_token_of_an_older_generation_is_refused_even_when_not_revoked() {
        let (registry, token) = minted();
        let next = LiveTree {
            generation: 4,
            ..live()
        };

        assert_eq!(
            registry.authorize(Some(&token), "agent status", next, NOW),
            Err(CapabilityRefusal::StaleGeneration)
        );
    }

    #[test]
    fn a_token_is_refused_for_another_tree_or_another_turn() {
        let (registry, token) = minted();
        let other_tree = LiveTree {
            tree_id: "tree-9",
            ..live()
        };
        let other_run = LiveTree {
            active_run_id: "run-8",
            ..live()
        };

        assert_eq!(
            registry.authorize(Some(&token), "agent status", other_tree, NOW),
            Err(CapabilityRefusal::WrongTree)
        );
        assert_eq!(
            registry.authorize(Some(&token), "agent status", other_run, NOW),
            Err(CapabilityRefusal::WrongRun)
        );
    }
}
