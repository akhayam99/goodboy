import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { isQueryBridgeServing } from './queryBridge';

describe('isQueryBridgeServing', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it('reports what the backend answers', async () => {
    invoke.mockResolvedValueOnce(true);

    await expect(isQueryBridgeServing()).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith('query_bridge_serving');
  });

  it('reports a bridge that is not serving', async () => {
    invoke.mockResolvedValueOnce(false);

    await expect(isQueryBridgeServing()).resolves.toBe(false);
  });

  it('fails closed when the command cannot be reached', async () => {
    invoke.mockRejectedValueOnce(new Error('command not found'));

    await expect(isQueryBridgeServing()).resolves.toBe(false);
  });
});
