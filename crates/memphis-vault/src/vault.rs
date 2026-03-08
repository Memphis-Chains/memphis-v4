use crate::error::VaultError;
use crate::types::{VaultEntry, VaultInitRequest, VaultInitResult};
use sha2::{Digest, Sha256};

// NOTE: placeholder derivation for Phase 1 scaffold.
// Blueprint target is Argon2id; this function provides deterministic shape only.
pub fn derive_master_key(passphrase: &str, salt: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(passphrase.as_bytes());
    hasher.update(salt);
    let out = hasher.finalize();

    let mut key = [0u8; 32];
    key.copy_from_slice(&out[..32]);
    key
}

pub fn init_vault(req: VaultInitRequest) -> Result<VaultInitResult, VaultError> {
    if req.passphrase.trim().is_empty() {
        return Err(VaultError::NotImplemented("init_vault: empty passphrase"));
    }

    Ok(VaultInitResult {
        version: 1,
        did: "did:memphis:phase1-placeholder".to_string(),
    })
}

pub fn encrypt_entry(key: &str, plaintext: &str) -> Result<VaultEntry, VaultError> {
    if key.trim().is_empty() {
        return Err(VaultError::NotImplemented("encrypt_entry: empty key"));
    }

    // Placeholder envelope: no real encryption yet (Phase 1 scaffold only).
    Ok(VaultEntry {
        key: key.to_string(),
        encrypted: format!("plain:{plaintext}"),
        iv: "phase1-placeholder-iv".to_string(),
    })
}

pub fn decrypt_entry(entry: &VaultEntry) -> Result<String, VaultError> {
    let prefix = "plain:";
    if let Some(rest) = entry.encrypted.strip_prefix(prefix) {
        return Ok(rest.to_string());
    }

    Err(VaultError::NotImplemented(
        "decrypt_entry: unsupported ciphertext format",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_master_key_is_deterministic_for_same_inputs() {
        let salt = b"fixed-salt";
        let a = derive_master_key("pass", salt);
        let b = derive_master_key("pass", salt);
        assert_eq!(a, b);
    }

    #[test]
    fn init_encrypt_decrypt_scaffold_roundtrip() {
        let req = VaultInitRequest {
            passphrase: "VeryStrongPassphrase!123".into(),
            recovery_question: "q".into(),
            recovery_answer: "a".into(),
        };

        let init = init_vault(req).expect("init_vault should produce scaffold result");
        assert_eq!(init.version, 1);

        let entry = encrypt_entry("openai_api_key", "secret-value")
            .expect("encrypt_entry should produce scaffold envelope");
        let plain = decrypt_entry(&entry).expect("decrypt_entry should parse scaffold envelope");
        assert_eq!(plain, "secret-value");
    }
}
