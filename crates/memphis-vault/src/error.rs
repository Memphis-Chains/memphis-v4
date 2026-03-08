use thiserror::Error;

#[derive(Debug, Error)]
pub enum VaultError {
    #[error("not implemented: {0}")]
    NotImplemented(&'static str),
}
