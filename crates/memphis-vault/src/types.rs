use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultInitRequest {
    pub passphrase: String,
    pub recovery_question: String,
    pub recovery_answer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultInitResult {
    pub version: u8,
    pub did: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultEntry {
    pub key: String,
    pub encrypted: String,
    pub iv: String,
}
