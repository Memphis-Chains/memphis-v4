use crate::error::VaultError;
use crate::types::{VaultEntry, VaultInitRequest, VaultInitResult};

pub fn init_vault(_req: VaultInitRequest) -> Result<VaultInitResult, VaultError> {
    Err(VaultError::NotImplemented("init_vault"))
}

pub fn encrypt_entry(_key: &str, _plaintext: &str) -> Result<VaultEntry, VaultError> {
    Err(VaultError::NotImplemented("encrypt_entry"))
}

pub fn decrypt_entry(_entry: &VaultEntry) -> Result<String, VaultError> {
    Err(VaultError::NotImplemented("decrypt_entry"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stubs_return_not_implemented() {
        let req = VaultInitRequest {
            passphrase: "x".into(),
            recovery_question: "q".into(),
            recovery_answer: "a".into(),
        };
        assert!(init_vault(req).is_err());
        assert!(encrypt_entry("k", "v").is_err());
    }
}
