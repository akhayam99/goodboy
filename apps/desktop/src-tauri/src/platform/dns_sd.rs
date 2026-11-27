use std::ffi::{c_char, c_void, CString};

use crate::bridge::{Advertiser, SERVICE_NAME};

type Reference = *mut c_void;

type Callback = Option<
    unsafe extern "C" fn(
        Reference,
        u32,
        i32,
        *const c_char,
        *const c_char,
        *const c_char,
        *mut c_void,
    ),
>;

extern "C" {
    fn DNSServiceRegister(
        reference: *mut Reference,
        flags: u32,
        interface_index: u32,
        name: *const c_char,
        service_type: *const c_char,
        domain: *const c_char,
        host: *const c_char,
        port: u16,
        txt_len: u16,
        txt: *const c_void,
        callback: Callback,
        context: *mut c_void,
    ) -> i32;
    fn DNSServiceRefDeallocate(reference: Reference);
}

struct Registration(Reference);

unsafe impl Send for Registration {}

pub struct DnsSdAdvertiser {
    registrations: Vec<Registration>,
}

impl DnsSdAdvertiser {
    pub fn new() -> Self {
        Self {
            registrations: Vec::new(),
        }
    }
}

fn index_of(interface: &str) -> Option<u32> {
    let name = CString::new(interface).ok()?;
    match unsafe { libc::if_nametoindex(name.as_ptr()) } {
        0 => None,
        index => Some(index),
    }
}

impl Advertiser for DnsSdAdvertiser {
    fn advertise(
        &mut self,
        instance: &str,
        port: u16,
        interfaces: &[String],
    ) -> Result<(), String> {
        self.withdraw();
        if instance.is_empty() {
            return Err("an empty instance name would fall back to the computer name".into());
        }
        let name = CString::new(instance).map_err(|e| e.to_string())?;
        let service_type = CString::new(SERVICE_NAME).map_err(|e| e.to_string())?;
        for interface in interfaces {
            let Some(index) = index_of(interface) else {
                continue;
            };
            let mut reference: Reference = std::ptr::null_mut();
            let code = unsafe {
                DNSServiceRegister(
                    &mut reference,
                    0,
                    index,
                    name.as_ptr(),
                    service_type.as_ptr(),
                    std::ptr::null(),
                    std::ptr::null(),
                    port.to_be(),
                    0,
                    std::ptr::null(),
                    None,
                    std::ptr::null_mut(),
                )
            };
            if code == 0 && !reference.is_null() {
                self.registrations.push(Registration(reference));
            }
        }
        match self.registrations.is_empty() {
            true => Err("no private interface could be registered".into()),
            false => Ok(()),
        }
    }

    fn withdraw(&mut self) {
        for Registration(reference) in self.registrations.drain(..) {
            unsafe { DNSServiceRefDeallocate(reference) };
        }
    }
}

impl Drop for DnsSdAdvertiser {
    fn drop(&mut self) {
        self.withdraw();
    }
}
