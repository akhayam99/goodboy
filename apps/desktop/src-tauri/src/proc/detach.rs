use std::process::Child;

pub(crate) fn detach(mut child: Child) {
    let spawned = std::thread::Builder::new()
        .name("detached-child-reaper".to_string())
        .spawn(move || {
            let _ = child.wait();
        });
    if let Err(error) = spawned {
        log::warn!("could not start a reaper thread for a detached child: {error}");
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::process::Command;
    use std::time::Duration;

    fn process_state(pid: u32) -> String {
        let output = Command::new("ps")
            .args(["-o", "stat=", "-p", &pid.to_string()])
            .output()
            .expect("run ps");
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    }

    #[test]
    fn detach_reaps_a_child_that_exits() {
        let child = Command::new("sh")
            .args(["-c", "exit 0"])
            .spawn()
            .expect("spawn sh");
        let pid = child.id();
        detach(child);
        std::thread::sleep(Duration::from_millis(500));
        assert_eq!(process_state(pid), "");
    }

    #[test]
    fn an_undetached_child_stays_a_zombie() {
        let child = Command::new("sh")
            .args(["-c", "exit 0"])
            .spawn()
            .expect("spawn sh");
        let pid = child.id();
        std::thread::sleep(Duration::from_millis(500));
        assert!(process_state(pid).starts_with('Z'));
        drop(child);
    }
}
