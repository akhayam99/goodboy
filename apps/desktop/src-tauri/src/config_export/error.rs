use crate::db::DbError;

#[derive(Debug, thiserror::Error)]
pub enum ConfigExportError {
    #[error("db error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("db mutex poisoned")]
    Poisoned,
    #[error("schema version mismatch: got {got}, expected {expected}")]
    SchemaMismatch { got: u32, expected: u32 },
    #[error("validation error: {0}")]
    Validation(String),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
}

crate::util::impl_error_serialize!(ConfigExportError);

impl ConfigExportError {
    fn kind(&self) -> &'static str {
        match self {
            ConfigExportError::Db(_) => "db",
            ConfigExportError::Poisoned => "poisoned",
            ConfigExportError::SchemaMismatch { .. } => "schema_mismatch",
            ConfigExportError::Validation(_) => "validation",
            ConfigExportError::Json(_) => "json",
        }
    }
}

impl From<DbError> for ConfigExportError {
    fn from(e: DbError) -> Self {
        match e {
            DbError::Sqlite(inner) => ConfigExportError::Db(inner),
            DbError::Poisoned => ConfigExportError::Poisoned,
            _ => ConfigExportError::Validation(e.to_string()),
        }
    }
}
