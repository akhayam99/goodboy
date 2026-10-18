use std::ffi::OsString;
use std::os::windows::ffi::{OsStrExt, OsStringExt};

use windows_sys::Win32::Foundation::ERROR_SUCCESS;
use windows_sys::Win32::System::Registry::{
    RegCloseKey, RegEnumKeyExW, RegGetValueW, RegOpenKeyExW, HKEY, HKEY_CURRENT_USER,
    HKEY_LOCAL_MACHINE, KEY_READ, RRF_RT_REG_SZ,
};

#[derive(Clone, Copy)]
pub enum Root {
    CurrentUser,
    LocalMachine,
}

fn handle(root: Root) -> HKEY {
    match root {
        Root::CurrentUser => HKEY_CURRENT_USER,
        Root::LocalMachine => HKEY_LOCAL_MACHINE,
    }
}

fn wide(text: &str) -> Vec<u16> {
    std::ffi::OsStr::new(text)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

pub fn read_string(root: Root, subkey: &str, value: &str) -> Option<String> {
    let subkey = wide(subkey);
    let value = wide(value);
    let flags = RRF_RT_REG_SZ;
    let mut bytes: u32 = 0;
    let status = unsafe {
        RegGetValueW(
            handle(root),
            subkey.as_ptr(),
            value.as_ptr(),
            flags,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            &mut bytes,
        )
    };
    if status != ERROR_SUCCESS || bytes == 0 {
        return None;
    }
    let mut buffer = vec![0u16; (bytes as usize).div_ceil(2)];
    let status = unsafe {
        RegGetValueW(
            handle(root),
            subkey.as_ptr(),
            value.as_ptr(),
            flags,
            std::ptr::null_mut(),
            buffer.as_mut_ptr().cast(),
            &mut bytes,
        )
    };
    if status != ERROR_SUCCESS {
        return None;
    }
    let end = buffer
        .iter()
        .position(|unit| *unit == 0)
        .unwrap_or(buffer.len());
    OsString::from_wide(&buffer[..end]).into_string().ok()
}

pub fn subkeys(root: Root, subkey: &str) -> Vec<String> {
    let path = wide(subkey);
    let mut key: HKEY = std::ptr::null_mut();
    let status = unsafe { RegOpenKeyExW(handle(root), path.as_ptr(), 0, KEY_READ, &mut key) };
    if status != ERROR_SUCCESS {
        return Vec::new();
    }
    let mut names = Vec::new();
    let mut index = 0u32;
    loop {
        let mut name = [0u16; 256];
        let mut length = name.len() as u32;
        let status = unsafe {
            RegEnumKeyExW(
                key,
                index,
                name.as_mut_ptr(),
                &mut length,
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            )
        };
        if status != ERROR_SUCCESS {
            break;
        }
        names.push(String::from_utf16_lossy(&name[..length as usize]));
        index += 1;
    }
    unsafe { RegCloseKey(key) };
    names
}

pub fn persisted_path() -> Vec<String> {
    [
        read_string(
            Root::LocalMachine,
            "SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment",
            "Path",
        ),
        read_string(Root::CurrentUser, "Environment", "Path"),
    ]
    .into_iter()
    .flatten()
    .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_persisted_path_is_read_from_the_registry() {
        let persisted = persisted_path();
        assert!(!persisted.is_empty());
        assert!(persisted.iter().all(|list| !list.contains('%')));
    }
}
