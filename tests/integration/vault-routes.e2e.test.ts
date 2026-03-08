import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppContainer } from '../../src/app/container.js';
import { createHttpServer } from '../../src/infra/http/server.js';
import type { AppConfig } from '../../src/infra/config/schema.js';

function cfg(db: string): AppConfig {
  return {
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: 0,
    LOG_LEVEL: 'error',
    DEFAULT_PROVIDER: 'local-fallback',
    SHARED_LLM_API_BASE: undefined,
    SHARED_LLM_API_KEY: undefined,
    DECENTRALIZED_LLM_API_BASE: undefined,
    DECENTRALIZED_LLM_API_KEY: undefined,
    LOCAL_FALLBACK_ENABLED: true,
    GEN_TIMEOUT_MS: 30000,
    GEN_MAX_TOKENS: 512,
    GEN_TEMPERATURE: 0.4,
    RUST_CHAIN_ENABLED: false,
    RUST_CHAIN_BRIDGE_PATH: './crates/memphis-napi',
    DATABASE_URL: `file:${db}`,
  };
}

describe('vault routes e2e', () => {
  it('returns 503 while rust vault bridge is disabled', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mv4-vault-e2e-'));
    const conf = cfg(join(dir, 'vault.db'));
    const c = createAppContainer(conf);
    const app = createHttpServer(conf, c.orchestration, {
      sessionRepository: c.sessionRepository,
      generationEventRepository: c.generationEventRepository,
    });

    const init = await app.inject({
      method: 'POST',
      url: '/v1/vault/init',
      payload: {
        passphrase: 'VeryStrongPassphrase!123',
        recovery_question: 'pet?',
        recovery_answer: 'nori',
      },
    });

    expect(init.statusCode).toBe(503);

    const encrypt = await app.inject({
      method: 'POST',
      url: '/v1/vault/encrypt',
      payload: { key: 'openai_api_key', plaintext: 'secret' },
    });

    expect(encrypt.statusCode).toBe(503);

    const decrypt = await app.inject({
      method: 'POST',
      url: '/v1/vault/decrypt',
      payload: { entry: { key: 'k', encrypted: 'x', iv: 'y' } },
    });

    expect(decrypt.statusCode).toBe(503);

    await app.close();
  });
});
