use std::process::Command;

#[cfg(unix)]
use std::time::Duration;

#[cfg(unix)]
const GROUP_DRAIN_POLLS: u32 = 6;
#[cfg(unix)]
const GROUP_DRAIN_INTERVAL: Duration = Duration::from_millis(50);

#[cfg(unix)]
pub fn isolate(command: &mut Command) {
    use std::os::unix::process::CommandExt;
    command.process_group(0);
}

#[cfg(not(unix))]
pub fn isolate(_command: &mut Command) {}

#[cfg(unix)]
pub fn terminate(pid: u32) {
    let group = pid as libc::pid_t;
    if unsafe { libc::killpg(group, libc::SIGTERM) } != 0 {
        unsafe { libc::kill(group, libc::SIGKILL) };
        return;
    }
    for _ in 0..GROUP_DRAIN_POLLS {
        std::thread::sleep(GROUP_DRAIN_INTERVAL);
        if !group_alive(group) {
            return;
        }
    }
    unsafe { libc::killpg(group, libc::SIGKILL) };
}

#[cfg(not(unix))]
pub fn terminate(_pid: u32) {}

#[cfg(unix)]
fn group_alive(group: libc::pid_t) -> bool {
    unsafe { libc::kill(-group, 0) == 0 }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader};
    use std::process::Stdio;

    fn is_alive(pid: libc::pid_t) -> bool {
        unsafe { libc::kill(pid, 0) == 0 }
    }

    #[test]
    fn terminate_stops_a_backgrounded_grandchild() {
        let mut command = Command::new("/bin/sh");
        command
            .arg("-c")
            .arg("sleep 30 & echo $!; wait")
            .stdout(Stdio::piped());
        isolate(&mut command);
        let mut child = command.spawn().expect("spawn sh");
        let mut line = String::new();
        BufReader::new(child.stdout.take().expect("stdout"))
            .read_line(&mut line)
            .expect("read grandchild pid");
        let grandchild: libc::pid_t = line.trim().parse().expect("grandchild pid");
        assert!(is_alive(grandchild));

        terminate(child.id());
        let _ = child.wait();

        let mut alive = true;
        for _ in 0..60 {
            if !is_alive(grandchild) {
                alive = false;
                break;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        assert!(!alive, "the grandchild survived its group's termination");
    }

    #[test]
    fn terminate_falls_back_to_the_leader_outside_a_group() {
        let mut child = Command::new("sleep")
            .arg("30")
            .spawn()
            .expect("spawn sleep");
        terminate(child.id());
        let status = child.wait().expect("wait");
        assert!(!status.success());
    }
}
