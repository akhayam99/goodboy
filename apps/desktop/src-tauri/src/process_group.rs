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
pub fn kill(pid: u32) {
    let group = pid as libc::pid_t;
    if unsafe { libc::killpg(group, libc::SIGKILL) } != 0 {
        unsafe { libc::kill(group, libc::SIGKILL) };
    }
}

#[cfg(not(unix))]
pub fn kill(_pid: u32) {}

#[cfg(unix)]
fn group_alive(group: libc::pid_t) -> bool {
    unsafe { libc::kill(-group, 0) == 0 }
}

#[cfg(windows)]
pub use job::Job;

#[cfg(windows)]
mod job {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectBasicProcessIdList,
        JobObjectExtendedLimitInformation, QueryInformationJobObject, SetInformationJobObject,
        TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    const LISTED_PROCESSES: usize = 256;

    #[repr(C)]
    struct ProcessIdList {
        assigned: u32,
        listed: u32,
        ids: [usize; LISTED_PROCESSES],
    }

    pub struct Job(HANDLE);

    unsafe impl Send for Job {}
    unsafe impl Sync for Job {}

    impl Job {
        pub fn assign(child: &std::process::Child) -> Option<Job> {
            Self::assign_handle(child.as_raw_handle() as HANDLE)
        }

        pub fn assign_handle(process: HANDLE) -> Option<Job> {
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
            let is_assigned = unsafe { AssignProcessToJobObject(handle, process) } != 0;
            if !is_assigned {
                return None;
            }
            Some(job)
        }

        pub fn terminate(&self) {
            unsafe { TerminateJobObject(self.0, 1) };
        }

        pub fn process_ids(&self) -> Option<Vec<u32>> {
            let mut list = ProcessIdList {
                assigned: 0,
                listed: 0,
                ids: [0; LISTED_PROCESSES],
            };
            let is_read = unsafe {
                QueryInformationJobObject(
                    self.0,
                    JobObjectBasicProcessIdList,
                    &mut list as *mut ProcessIdList as *mut std::ffi::c_void,
                    std::mem::size_of::<ProcessIdList>() as u32,
                    std::ptr::null_mut(),
                )
            } != 0;
            if !is_read {
                return None;
            }
            let listed = (list.listed as usize).min(LISTED_PROCESSES);
            Some(list.ids[..listed].iter().map(|id| *id as u32).collect())
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

#[cfg(all(test, windows))]
mod windows_tests {
    use super::*;
    use std::time::{Duration, Instant};

    #[test]
    fn a_job_lists_its_processes_and_terminate_stops_them() {
        let mut child = std::process::Command::new("cmd")
            .args(["/d", "/c", "ping -n 30 127.0.0.1 >nul"])
            .spawn()
            .expect("start cmd");
        let job = Job::assign(&child).expect("assign the job");
        let deadline = Instant::now() + Duration::from_secs(10);
        let mut ids = job.process_ids().unwrap_or_default();
        while ids.len() < 2 && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(100));
            ids = job.process_ids().unwrap_or_default();
        }
        assert!(ids.contains(&child.id()), "got {ids:?}");

        job.terminate();

        assert!(child.wait().is_ok());
        assert_eq!(job.process_ids().map(|ids| ids.len()), Some(0));
    }
}
