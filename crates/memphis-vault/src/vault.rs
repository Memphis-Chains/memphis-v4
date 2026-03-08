use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::Argon2;
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use rand::RngCore;
use sha2::{Digest, Sha256};

use crate::error::VaultError;
use crate::types::{VaultEntry, VaultInitRequest, VaultInitResult};

const ENCRYPTION_DOMAIN_SALT: &[u8] = b"memphis-vault-phase1-domain-salt";
const CIPHER_FORMAT_V1: &str = "mv1";

pub fn derive_master_key(passphrase: &str, salt: &[u8]) -> Result<[u8; 32], VaultError> {
    if passphrase.trim().is_empty() {
        return Err(VaultError::InvalidInput("empty passphrase"));
    }
    if salt.len() < 8 {
        return Err(VaultError::InvalidInput("salt too short (min 8 bytes)"));
    }

    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(passphrase.as_bytes(), salt, &mut key)
        .map_err(|_| VaultError::CryptoFailure)?;
    Ok(key)
}

pub fn init_vault(req: VaultInitRequest) -> Result<VaultInitResult, VaultError> {
    if req.passphrase.trim().is_empty() {
        return Err(VaultError::InvalidInput("init_vault: empty passphrase"));
    }

    // Deterministic DID scaffold from passphrase + recovery question hash.
    let mut hasher = Sha256::new();
    hasher.update(req.passphrase.as_bytes());
    hasher.update(req.recovery_question.as_bytes());
    let digest = hasher.finalize();

    Ok(VaultInitResult {
        version: 1,
        did: format!("did:memphis:{}", hex_short(&digest[..16])),
    })
}

pub fn encrypt_entry(key: &str, plaintext: &str) -> Result<VaultEntry, VaultError> {
    if key.trim().is_empty() {
        return Err(VaultError::InvalidInput("encrypt_entry: empty key"));
    }

    // Phase 1.5 hardening:
    // - key is treated as key alias/identifier
    // - cipher payload explicitly versioned for migration-safe decoding
    let enc_key = derive_master_key(key, ENCRYPTION_DOMAIN_SALT)?;
    let cipher = Aes256Gcm::new_from_slice(&enc_key).map_err(|_| VaultError::CryptoFailure)?;

    let mut iv = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut iv);
    let nonce = Nonce::from_slice(&iv);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|_| VaultError::CryptoFailure)?;

    Ok(VaultEntry {
        key: key.to_string(),
        encrypted: format!("{CIPHER_FORMAT_V1}:{}", B64.encode(ciphertext)),
        iv: B64.encode(iv),
    })
}

pub fn decrypt_entry(entry: &VaultEntry) -> Result<String, VaultError> {
    // Backward-compatible decode path:
    // - new format: "mv1:<base64-ciphertext>"
    // - legacy format: "<base64-ciphertext>"
    // - legacy scaffold format: "plain:<plaintext>"
    if let Some(rest) = entry.encrypted.strip_prefix("plain:") {
        return Ok(rest.to_string());
    }

    let enc_key = derive_master_key(&entry.key, ENCRYPTION_DOMAIN_SALT)?;
    let cipher = Aes256Gcm::new_from_slice(&enc_key).map_err(|_| VaultError::CryptoFailure)?;

    let iv = B64.decode(&entry.iv).map_err(|_| VaultError::EncodingFailure)?;
    if iv.len() != 12 {
        return Err(VaultError::InvalidInput("invalid iv length"));
    }
    let nonce = Nonce::from_slice(&iv);

    let payload = if let Some(v1) = entry.encrypted.strip_prefix(&format!("{CIPHER_FORMAT_V1}:")) {
        v1
    } else {
        // migration fallback for pre-v1 formatted ciphertext
        entry.encrypted.as_str()
    };

    let ciphertext = B64.decode(payload).map_err(|_| VaultError::EncodingFailure)?;

    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| VaultError::CryptoFailure)?;

    String::from_utf8(plaintext).map_err(|_| VaultError::EncodingFailure)
}

fn hex_short(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect::<String>()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_master_key_is_deterministic_for_same_inputs() {
        let salt = b"fixed-salt";
        let a = derive_master_key("pass", salt).expect("derive A");
        let b = derive_master_key("pass", salt).expect("derive B");
        assert_eq!(a, b);
    }

    #[test]
    fn derive_master_key_changes_with_salt() {
        let a = derive_master_key("pass", b"salt-aaaa").expect("derive A");
        let b = derive_master_key("pass", b"salt-bbbb").expect("derive B");
        assert_ne!(a, b);
    }

    #[test]
    fn init_encrypt_decrypt_roundtrip() {
        let req = VaultInitRequest {
            passphrase: "VeryStrongPassphrase!123".into(),
            recovery_question: "q".into(),
            recovery_answer: "a".into(),
        };

        let init = init_vault(req).expect("init_vault should produce scaffold result");
        assert_eq!(init.version, 1);
        assert!(init.did.starts_with("did:memphis:"));

        let entry = encrypt_entry("openai_api_key", "secret-value").expect("encrypt");
        let plain = decrypt_entry(&entry).expect("decrypt");
        assert_eq!(plain, "secret-value");
    }

    #[test]
    fn decrypt_fails_for_corrupted_ciphertext() {
        let mut entry = encrypt_entry("openai_api_key", "secret-value").expect("encrypt");
        entry.encrypted = "@@not-base64@@".to_string();
        assert!(decrypt_entry(&entry).is_err());
    }

    #[test]
    fn decrypt_accepts_legacy_plain_prefix() {
        let entry = VaultEntry {
            key: "openai_api_key".to_string(),
            encrypted: "plain:legacy-secret".to_string(),
            iv: "ignored".to_string(),
        };
        let plain = decrypt_entry(&entry).expect("legacy plain decrypt");
        assert_eq!(plain, "legacy-secret");
    }

    #[test]
    fn encrypt_sets_versioned_ciphertext_prefix() {
        let entry = encrypt_entry("openai_api_key", "secret-value").expect("encrypt");
        assert!(entry.encrypted.starts_with("mv1:"));
    }
}
