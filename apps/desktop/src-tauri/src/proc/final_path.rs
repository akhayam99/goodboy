use std::ffi::{c_void, OsString};
use std::fs::File;
use std::os::windows::ffi::OsStringExt;
use std::os::windows::io::AsRawHandle;
use std::path::PathBuf;

#[link(name = "kernel32")]
extern "system" {
    fn GetFinalPathNameByHandleW(file: *mut c_void, path: *mut u16, size: u32, flags: u32) -> u32;
}

pub(crate) fn of_handle(file: &File) -> Option<PathBuf> {
    let mut buffer: Vec<u16> = vec![0; 512];
    loop {
        let size = u32::try_from(buffer.len()).ok()?;
        let written = unsafe {
            GetFinalPathNameByHandleW(file.as_raw_handle(), buffer.as_mut_ptr(), size, 0)
        };
        let written = usize::try_from(written).ok()?;
        if written == 0 {
            return None;
        }
        if written < buffer.len() {
            buffer.truncate(written);
            return Some(PathBuf::from(OsString::from_wide(&buffer)));
        }
        buffer.resize(written, 0);
    }
}
