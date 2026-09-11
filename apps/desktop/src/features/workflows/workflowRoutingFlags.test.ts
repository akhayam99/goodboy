import { afterEach, describe, expect, it, vi } from 'vitest';
import { workflowRoutingFlags } from './workflowRoutingFlags';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('workflowRoutingFlags', () => {
  it('keeps model metadata off when nothing set the flag', () => {
    expect(workflowRoutingFlags().isModelMetadataEnabled).toBe(false);
  });

  it('turns model metadata on only for an explicit true', () => {
    vi.stubEnv('VITE_WORKFLOW_MODEL_METADATA', 'true');
    expect(workflowRoutingFlags().isModelMetadataEnabled).toBe(true);

    vi.stubEnv('VITE_WORKFLOW_MODEL_METADATA', 'TRUE');
    expect(workflowRoutingFlags().isModelMetadataEnabled).toBe(true);
  });

  it('reads any other value as off', () => {
    vi.stubEnv('VITE_WORKFLOW_MODEL_METADATA', '1');
    expect(workflowRoutingFlags().isModelMetadataEnabled).toBe(false);

    vi.stubEnv('VITE_WORKFLOW_MODEL_METADATA', 'false');
    expect(workflowRoutingFlags().isModelMetadataEnabled).toBe(false);

    vi.stubEnv('VITE_WORKFLOW_MODEL_METADATA', '');
    expect(workflowRoutingFlags().isModelMetadataEnabled).toBe(false);
  });
});
