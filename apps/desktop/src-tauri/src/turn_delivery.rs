use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};

use serde::Serialize;

const MAX_REMEMBERED: usize = 2048;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryRun {
    pub run_id: String,
    pub is_live: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DeliveryClaim {
    Claimed,
    Duplicate(String),
}

#[derive(Default)]
struct Inner {
    run_by_delivery: HashMap<String, String>,
    order: VecDeque<String>,
}

#[derive(Default, Clone)]
pub struct DeliveryRegistry {
    inner: Arc<Mutex<Inner>>,
}

fn locked(inner: &Mutex<Inner>) -> MutexGuard<'_, Inner> {
    inner.lock().unwrap_or_else(PoisonError::into_inner)
}

impl DeliveryRegistry {
    pub fn claim(
        &self,
        delivery_id: &str,
        run_id: &str,
        is_live: impl Fn(&str) -> bool,
    ) -> DeliveryClaim {
        let mut inner = locked(&self.inner);
        if let Some(existing) = inner.run_by_delivery.get(delivery_id) {
            return DeliveryClaim::Duplicate(existing.clone());
        }
        inner
            .run_by_delivery
            .insert(delivery_id.to_string(), run_id.to_string());
        inner.order.push_back(delivery_id.to_string());
        Self::forget_oldest_finished(&mut inner, &is_live);
        DeliveryClaim::Claimed
    }

    pub fn release(&self, delivery_id: &str, run_id: &str) {
        let mut inner = locked(&self.inner);
        if inner.run_by_delivery.get(delivery_id).map(String::as_str) != Some(run_id) {
            return;
        }
        inner.run_by_delivery.remove(delivery_id);
        inner.order.retain(|candidate| candidate != delivery_id);
    }

    pub fn lookup(&self, delivery_id: &str, is_live: impl Fn(&str) -> bool) -> Option<DeliveryRun> {
        let inner = locked(&self.inner);
        let run_id = inner.run_by_delivery.get(delivery_id)?;
        Some(DeliveryRun {
            run_id: run_id.clone(),
            is_live: is_live(run_id),
        })
    }

    fn forget_oldest_finished(inner: &mut Inner, is_live: &impl Fn(&str) -> bool) {
        let mut scanned = 0;
        while inner.order.len() > MAX_REMEMBERED && scanned < inner.order.len() {
            let Some(oldest) = inner.order.pop_front() else {
                return;
            };
            let run_is_live = inner
                .run_by_delivery
                .get(&oldest)
                .map(|run_id| is_live(run_id))
                .unwrap_or(false);
            if run_is_live {
                inner.order.push_back(oldest);
                scanned += 1;
                continue;
            }
            inner.run_by_delivery.remove(&oldest);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn nothing_is_live(_run_id: &str) -> bool {
        false
    }

    #[test]
    fn the_first_run_of_a_delivery_is_claimed_and_a_second_is_refused() {
        let registry = DeliveryRegistry::default();
        assert_eq!(
            registry.claim("delivery-1", "run-1", nothing_is_live),
            DeliveryClaim::Claimed
        );
        assert_eq!(
            registry.claim("delivery-1", "run-2", nothing_is_live),
            DeliveryClaim::Duplicate("run-1".to_string())
        );
    }

    #[test]
    fn lookup_tells_a_live_run_from_a_finished_one() {
        let registry = DeliveryRegistry::default();
        registry.claim("delivery-1", "run-1", nothing_is_live);
        assert_eq!(
            registry.lookup("delivery-1", |run_id| run_id == "run-1"),
            Some(DeliveryRun {
                run_id: "run-1".to_string(),
                is_live: true
            })
        );
        assert_eq!(
            registry.lookup("delivery-1", nothing_is_live),
            Some(DeliveryRun {
                run_id: "run-1".to_string(),
                is_live: false
            })
        );
        assert_eq!(registry.lookup("delivery-9", nothing_is_live), None);
    }

    #[test]
    fn a_failed_spawn_gives_the_delivery_back_but_only_to_its_own_run() {
        let registry = DeliveryRegistry::default();
        registry.claim("delivery-1", "run-1", nothing_is_live);
        registry.release("delivery-1", "run-other");
        assert!(registry.lookup("delivery-1", nothing_is_live).is_some());
        registry.release("delivery-1", "run-1");
        assert_eq!(registry.lookup("delivery-1", nothing_is_live), None);
        assert_eq!(
            registry.claim("delivery-1", "run-2", nothing_is_live),
            DeliveryClaim::Claimed
        );
    }

    #[test]
    fn two_claims_at_once_let_exactly_one_through() {
        let registry = DeliveryRegistry::default();
        let handles: Vec<_> = (0..8)
            .map(|index| {
                let registry = registry.clone();
                std::thread::spawn(move || {
                    registry.claim("delivery-1", &format!("run-{index}"), nothing_is_live)
                })
            })
            .collect();
        let claimed = handles
            .into_iter()
            .map(|handle| handle.join().expect("claim thread"))
            .filter(|claim| *claim == DeliveryClaim::Claimed)
            .count();
        assert_eq!(claimed, 1);
    }

    #[test]
    fn the_oldest_finished_deliveries_are_forgotten_and_live_ones_are_kept() {
        let registry = DeliveryRegistry::default();
        registry.claim("delivery-live", "run-live", |run_id| run_id == "run-live");
        for index in 0..(MAX_REMEMBERED + 10) {
            registry.claim(
                &format!("delivery-{index}"),
                &format!("run-{index}"),
                |run_id| run_id == "run-live",
            );
        }
        assert!(registry
            .lookup("delivery-live", |run_id| run_id == "run-live")
            .is_some());
        assert_eq!(registry.lookup("delivery-0", nothing_is_live), None);
        assert!(registry
            .lookup(&format!("delivery-{}", MAX_REMEMBERED + 9), nothing_is_live)
            .is_some());
    }
}
