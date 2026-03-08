import { describe, expect, it } from 'vitest';
import { getChainAdapterStatus } from '../../src/infra/storage/chain-adapter.js';

describe('chain adapter feature flag', () => {
  it('defaults to ts-legacy when rust flag is off', () => {
    const out = getChainAdapterStatus({
      RUST_CHAIN_ENABLED: 'false',
    } as NodeJS.ProcessEnv);

    expect(out.backend).toBe('ts-legacy');
    expect(out.rustEnabled).toBe(false);
    expect(out.rustBridgeLoaded).toBe(false);
  });

  it('falls back to ts-legacy when rust flag is on but bridge path is unavailable', () => {
    const out = getChainAdapterStatus({
      RUST_CHAIN_ENABLED: 'true',
      RUST_CHAIN_BRIDGE_PATH: '/tmp/definitely-missing-bridge.node',
    } as NodeJS.ProcessEnv);

    expect(out.backend).toBe('ts-legacy');
    expect(out.rustEnabled).toBe(true);
    expect(out.rustBridgeLoaded).toBe(false);
  });
});
