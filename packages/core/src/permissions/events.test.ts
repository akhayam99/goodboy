import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { createPermissionRequestEvent } from './events';

const RUN_ID = brandId<ProviderRunId>({ value: 'run-1' });
const AT = brandId<IsoDateTime>({ value: '2026-01-01T00:00:00.000Z' });

describe('createPermissionRequestEvent', () => {
  it('produces a permission_request event with correct shape', () => {
    const event = createPermissionRequestEvent({
      runId: RUN_ID,
      toolUseId: 'tu-1',
      toolName: 'bash',
      input: { cmd: 'ls' },
      at: AT,
    });
    expect(event.kind).toBe('permission_request');
    expect(event.runId).toBe(RUN_ID);
    expect(event.toolUseId).toBe('tu-1');
    expect(event.toolName).toBe('bash');
    expect(event.input).toEqual({ cmd: 'ls' });
    expect(event.at).toBe(AT);
  });

  it('accepts null/unknown input', () => {
    const event = createPermissionRequestEvent({
      runId: RUN_ID,
      toolUseId: 'tu-2',
      toolName: 'read_file',
      input: null,
      at: AT,
    });
    expect(event.input).toBeNull();
  });
});
