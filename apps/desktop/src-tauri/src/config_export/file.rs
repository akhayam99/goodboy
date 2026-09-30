use crate::config_export::error::ConfigExportError;

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
