use crate::config_export::bundle::ConfigBundle;
use crate::config_export::error::ConfigExportError;
use sha2::{Digest, Sha256};

pub(super) struct BundleFile {
    pub sha256: String,
    pub bundle: ConfigBundle,
}

pub(super) fn read_bundle_file(path: &str) -> Result<BundleFile, ConfigExportError> {
    let bytes = std::fs::read(path).map_err(|e| ConfigExportError::Validation(e.to_string()))?;
    let sha256 = format!("{:x}", Sha256::digest(&bytes));
    let bundle: ConfigBundle = serde_json::from_slice(&bytes)?;
    Ok(BundleFile { sha256, bundle })
}

pub(super) fn write_config_file(path: &str, json: &str) -> Result<(), ConfigExportError> {
    use std::io::Write;
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(path)
        .map_err(|e| ConfigExportError::Validation(e.to_string()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        file.set_permissions(std::fs::Permissions::from_mode(0o600))
            .map_err(|e| ConfigExportError::Validation(e.to_string()))?;
    }
    file.write_all(json.as_bytes())
        .map_err(|e| ConfigExportError::Validation(e.to_string()))
}
