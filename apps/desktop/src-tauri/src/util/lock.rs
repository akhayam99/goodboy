use std::sync::{Mutex, MutexGuard};

pub(crate) fn lock_or_recover<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    #[test]
    fn a_poisoned_mutex_still_opens() {
        let mutex = Arc::new(Mutex::new(vec![1]));
        let writer = Arc::clone(&mutex);
        let _ = std::thread::spawn(move || {
            let mut guard = writer.lock().expect("lock");
            guard.push(2);
            panic!("poison the lock");
        })
        .join();
        assert!(mutex.is_poisoned());

        assert_eq!(*lock_or_recover(&mutex), vec![1, 2]);
    }
}
