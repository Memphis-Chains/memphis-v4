import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { VaultEntry } from './rust-vault-adapter.js';

export interface StoredVaultEntry extends VaultEntry {
  createdAt: string;
}

function getStorePath(rawEnv: NodeJS.ProcessEnv): string {
  return rawEnv.MEMPHIS_VAULT_ENTRIES_PATH ?? './data/vault-entries.json';
}

function readAll(path: string): StoredVaultEntry[] {
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, 'utf8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw) as StoredVaultEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(path: string, entries: StoredVaultEntry[]): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(entries, null, 2));
}

export function saveVaultEntry(entry: VaultEntry, rawEnv: NodeJS.ProcessEnv = process.env): StoredVaultEntry {
  const path = getStorePath(rawEnv);
  const all = readAll(path);

  const stored: StoredVaultEntry = {
    ...entry,
    createdAt: new Date().toISOString(),
  };

  all.push(stored);
  writeAll(path, all);
  return stored;
}

export function listVaultEntries(rawEnv: NodeJS.ProcessEnv = process.env, key?: string): StoredVaultEntry[] {
  const path = getStorePath(rawEnv);
  const all = readAll(path);
  if (!key) return all;
  return all.filter((e) => e.key === key);
}
