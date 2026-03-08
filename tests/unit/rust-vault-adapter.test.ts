import { describe, expect, it } from 'vitest';
import { getRustVaultAdapterStatus } from '../../src/infra/storage/rust-vault-adapter.js';

describe('rust vault adapter status', () => {
  it('returns disabled status by default', () => {
    const out = getRustVaultAdapterStatus({
      RUST_CHAIN_ENABLED: 'false',
    } as NodeJS.ProcessEnv);

    expect(out.rustEnabled).toBe(false);
    expect(out.bridgeLoaded).toBe(false);
    expect(out.vaultApiAvailable).toBe(false);
  });

  it('returns safe fallback when bridge path is missing', () => {
    const out = getRustVaultAdapterStatus({
      RUST_CHAIN_ENABLED: 'true',
      RUST_CHAIN_BRIDGE_PATH: '/tmp/missing-rust-bridge.node',
    } as NodeJS.ProcessEnv);

    expect(out.rustEnabled).toBe(true);
    expect(out.bridgeLoaded).toBe(false);
    expect(out.vaultApiAvailable).toBe(false);
  });
});
