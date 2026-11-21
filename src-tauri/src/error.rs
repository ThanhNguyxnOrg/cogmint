use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("Git error: {0}")]
    Git(String),
    #[error("PTY error: {0}")]
    Pty(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    #[error("External error: {0}")]
    External(String),
}

pub type AppResult<T> = Result<T, AppError>;

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        #[derive(Serialize)]
        struct ErrorPayload<'a> {
            kind: &'a str,
            message: String,
        }

        let kind = match self {
            AppError::Io(_) => "io",
            AppError::Db(_) => "db",
            AppError::Git(_) => "git",
            AppError::Pty(_) => "pty",
            AppError::NotFound(_) => "notFound",
            AppError::InvalidInput(_) => "invalidInput",
            AppError::External(_) => "external",
        };

        ErrorPayload {
            kind,
            message: self.to_string(),
        }
        .serialize(serializer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_error_serializes_with_kind_and_message() {
        let json = serde_json::to_value(AppError::InvalidInput("bad branch".into())).unwrap();
        assert_eq!(json["kind"], "invalidInput");
        assert_eq!(json["message"], "Invalid input: bad branch");
    }
}
