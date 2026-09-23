use std::collections::HashMap;
use std::io::Read;
use std::process::Child;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

pub type ChildSlot = Arc<Mutex<Option<Child>>>;

#[derive(Clone)]
pub struct LiveChild {
    pub pid: u32,
    pub slot: ChildSlot,
}

pub type LiveChildRegistry = Arc<Mutex<HashMap<String, LiveChild>>>;

static ANONYMOUS_KEYS: AtomicU64 = AtomicU64::new(0);

impl LiveChild {
    pub fn new(child: Child) -> Self {
        Self {
            pid: child.id(),
            slot: Arc::new(Mutex::new(Some(child))),
        }
    }

    pub fn kill(&self) {
        let pid = self.pid;
        std::thread::spawn(move || crate::process_group::terminate(pid));
        self.kill_leader_fallback();
    }

    fn terminate_now(&self) {
        crate::process_group::terminate(self.pid);
        self.kill_leader_fallback();
    }

    #[cfg(unix)]
    fn kill_leader_fallback(&self) {}

    #[cfg(not(unix))]
    fn kill_leader_fallback(&self) {
        if let Ok(mut guard) = self.slot.try_lock() {
            if let Some(child) = guard.as_mut() {
                let _ = child.kill();
            }
        }
    }
}

pub fn anonymous_key(prefix: &str) -> String {
    let next = ANONYMOUS_KEYS.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}-{next}")
}

pub fn register(registry: &LiveChildRegistry, key: &str, live: &LiveChild) {
    if let Ok(mut map) = registry.lock() {
        map.insert(key.to_string(), live.clone());
    }
}

pub fn kill_one(registry: &LiveChildRegistry, key: &str) -> bool {
    let live = match registry.lock() {
        Ok(map) => map.get(key).cloned(),
        Err(_) => return false,
    };
    let Some(live) = live else {
        return false;
    };
    live.kill();
    true
}

pub fn shutdown(registry: &LiveChildRegistry) {
    let drained: Vec<LiveChild> = match registry.lock() {
        Ok(mut map) => map.drain().map(|(_, live)| live).collect(),
        Err(_) => return,
    };
    std::thread::scope(|scope| {
        for live in &drained {
            scope.spawn(move || live.terminate_now());
        }
    });
}

pub fn wait_and_remove(live: &LiveChild, registry: &LiveChildRegistry, key: &str) -> Option<i32> {
    let exit = {
        let mut guard = live.slot.lock().ok()?;
        let child = guard.as_mut()?;
        child.wait().ok().and_then(|status| status.code())
    };
    if let Ok(mut map) = registry.lock() {
        map.remove(key);
    }
    exit
}

pub fn drain_lossy<R: Read>(mut source: R) -> String {
    let mut buf = Vec::new();
    let _ = source.read_to_end(&mut buf);
    String::from_utf8_lossy(&buf).into_owned()
}

#[cfg(test)]
pub mod test_support {
    use super::*;
    use std::time::{Duration, Instant};

    pub fn register_sleeping(registry: &LiveChildRegistry, key: &str) -> LiveChild {
        let child = std::process::Command::new("sleep")
            .arg("30")
            .spawn()
            .expect("spawn sleep");
        let live = LiveChild::new(child);
        register(registry, key, &live);
        live
    }

    pub fn assert_waiter_returns(
        waiter: std::thread::JoinHandle<Option<i32>>,
        budget: Duration,
        message: &str,
    ) {
        let deadline = Instant::now() + budget;
        while !waiter.is_finished() {
            assert!(Instant::now() < deadline, "{message}");
            std::thread::sleep(Duration::from_millis(20));
        }
        let _ = waiter.join();
    }

    pub fn spawn_waiter(
        registry: &LiveChildRegistry,
        key: &str,
        live: &LiveChild,
    ) -> std::thread::JoinHandle<Option<i32>> {
        let registry = Arc::clone(registry);
        let key = key.to_string();
        let live = live.clone();
        let waiter = std::thread::spawn(move || wait_and_remove(&live, &registry, &key));
        std::thread::sleep(Duration::from_millis(50));
        waiter
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::test_support::*;
    use super::*;
    use std::time::Duration;

    #[test]
    fn kill_reaches_a_child_whose_slot_is_held_by_its_waiter() {
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let live = register_sleeping(&registry, "run-1");
        let waiter = spawn_waiter(&registry, "run-1", &live);

        assert!(kill_one(&registry, "run-1"));

        assert_waiter_returns(
            waiter,
            Duration::from_secs(2),
            "kill left the child running",
        );
        assert!(registry.lock().expect("registry").is_empty());
    }

    #[test]
    fn kill_for_an_unknown_key_is_a_no_op() {
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        assert!(!kill_one(&registry, "missing"));
    }

    #[test]
    fn anonymous_keys_never_repeat() {
        assert_ne!(anonymous_key("planner"), anonymous_key("planner"));
    }
}
