import { afterEach, describe, expect, it, vi } from 'vitest';
import { workflowRoutingFlags } from './workflowRoutingFlags';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('workflowRoutingFlags', () => {
  it('keeps model metadata on when nothing set the flag', () => {
    expect(workflowRoutingFlags().isModelMetadataEnabled).toBe(true);
  });

  it('turns model metadata off only for an explicit false', () => {
    vi.stubEnv('VITE_WORKFLOW_MODEL_METADATA', 'false');
    expect(workflowRoutingFlags().isModelMetadataEnabled).toBe(false);

    vi.stubEnv('VITE_WORKFLOW_MODEL_METADATA', 'FALSE');
    expect(workflowRoutingFlags().isModelMetadataEnabled).toBe(false);
  });

  it('reads any other value as on', () => {
    vi.stubEnv('VITE_WORKFLOW_MODEL_METADATA', '1');
    expect(workflowRoutingFlags().isModelMetadataEnabled).toBe(true);

    vi.stubEnv('VITE_WORKFLOW_MODEL_METADATA', 'true');
    expect(workflowRoutingFlags().isModelMetadataEnabled).toBe(true);

    vi.stubEnv('VITE_WORKFLOW_MODEL_METADATA', '');
    expect(workflowRoutingFlags().isModelMetadataEnabled).toBe(true);
  });

  it('reads the child model selection flag independently, defaulting to on', () => {
    expect(workflowRoutingFlags().isChildModelSelectionEnabled).toBe(true);

    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'false');
    expect(workflowRoutingFlags().isChildModelSelectionEnabled).toBe(false);
    expect(workflowRoutingFlags().isModelMetadataEnabled).toBe(true);
  });
  it('explicit false stays off in all four combinations, and an unset flag is on', () => {
    const combinations = [
      { metadata: 'true', children: 'true', isMetadataOn: true, isChildrenOn: true },
      { metadata: 'true', children: 'false', isMetadataOn: true, isChildrenOn: false },
      { metadata: 'false', children: 'true', isMetadataOn: false, isChildrenOn: true },
      { metadata: 'false', children: 'false', isMetadataOn: false, isChildrenOn: false },
    ] as const;

    for (const combination of combinations) {
      vi.stubEnv('VITE_WORKFLOW_MODEL_METADATA', combination.metadata);
      vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', combination.children);
      const flags = workflowRoutingFlags();
      expect({
        metadata: combination.metadata,
        children: combination.children,
        isModelMetadataEnabled: flags.isModelMetadataEnabled,
        isChildModelSelectionEnabled: flags.isChildModelSelectionEnabled,
      }).toEqual({
        metadata: combination.metadata,
        children: combination.children,
        isModelMetadataEnabled: combination.isMetadataOn,
        isChildModelSelectionEnabled: combination.isChildrenOn,
      });
    }

    vi.unstubAllEnvs();
    const unset = workflowRoutingFlags();
    expect(unset).toEqual({
      isModelMetadataEnabled: true,
      isChildModelSelectionEnabled: true,
    });

    vi.stubEnv('VITE_WORKFLOW_MODEL_METADATA', 'true');
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'true');
    expect(workflowRoutingFlags()).toEqual(unset);
  });
});
