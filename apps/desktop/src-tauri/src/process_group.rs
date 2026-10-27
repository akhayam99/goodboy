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
    use crate::proc::signal::{self, Signal};
    if signal::send_to_group(pid, Signal::Terminate).is_err() {
        let _ = signal::send(pid, Signal::Kill);
        return;
    }
    for _ in 0..GROUP_DRAIN_POLLS {
        std::thread::sleep(GROUP_DRAIN_INTERVAL);
        if !signal::group_has_members(pid) {
            return;
        }
    }
    let _ = signal::send_to_group(pid, Signal::Kill);
}

#[cfg(not(unix))]
pub fn terminate(_pid: u32) {}

#[cfg(unix)]
pub fn kill(pid: u32) {
    use crate::proc::signal::{self, Signal};
    if signal::send_to_group(pid, Signal::Kill).is_err() {
        let _ = signal::send(pid, Signal::Kill);
    }
}

#[cfg(not(unix))]
pub fn kill(_pid: u32) {}

#[cfg(windows)]
pub use job::Job;

#[cfg(windows)]
mod job {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    pub struct Job(HANDLE);

    unsafe impl Send for Job {}
    unsafe impl Sync for Job {}

    impl Job {
        pub fn assign(child: &std::process::Child) -> Option<Job> {
            let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
            if handle.is_null() {
                return None;
            }
            let job = Job(handle);
            let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { std::mem::zeroed() };
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            let is_limited = unsafe {
                SetInformationJobObject(
                    handle,
                    JobObjectExtendedLimitInformation,
                    &limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION
                        as *const std::ffi::c_void,
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                )
            } != 0;
            if !is_limited {
                return None;
            }
            let is_assigned =
                unsafe { AssignProcessToJobObject(handle, child.as_raw_handle() as HANDLE) } != 0;
            if !is_assigned {
                return None;
            }
            Some(job)
        }

        pub fn terminate(&self) {
            unsafe { TerminateJobObject(self.0, 1) };
        }
    }

    impl Drop for Job {
        fn drop(&mut self) {
            unsafe { CloseHandle(self.0) };
        }
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader};
    use std::process::Stdio;

    fn is_alive(pid: libc::pid_t) -> bool {
        crate::proc::signal::exists(pid as u32)
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
