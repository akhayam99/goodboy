import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId } from '@goodboy/types';

const { loadArtifactProvenance, appendArtifactProvenanceOmission } = vi.hoisted(() => ({
  loadArtifactProvenance: vi.fn(async () => ({ designProfileSummary: null }) as unknown),
  appendArtifactProvenanceOmission: vi.fn(async () => undefined),
}));

vi.mock('./artifactProvenance', () => ({
  loadArtifactProvenance,
  appendArtifactProvenanceOmission,
}));

import { recordArtifactAssumptions } from './recordArtifactAssumptions';

const AGENT_ID = 'agent-1' as AgentId;

const question = ({ text, blocking }: Readonly<{ text: string; blocking: boolean }>): string =>
  `<<ctx-question suggestions="one|two" recommended="one" select="one"${blocking ? ' blocking="true"' : ''}>>${text}<</ctx-question>>`;

beforeEach(() => {
  appendArtifactProvenanceOmission.mockClear();
  loadArtifactProvenance.mockClear();
  loadArtifactProvenance.mockResolvedValue({ designProfileSummary: null });
});

describe('recordArtifactAssumptions', () => {
  it('records the assumption only for the question it answered itself', async () => {
    const recorded = await recordArtifactAssumptions({
      agentId: AGENT_ID,
      assistantText: [
        question({ text: 'which surface leads?', blocking: false }),
        question({ text: 'renew the expired key?', blocking: true }),
      ].join('\n'),
    });

    expect(recorded).toBe(1);
    expect(appendArtifactProvenanceOmission).toHaveBeenCalledTimes(1);
    expect(appendArtifactProvenanceOmission).toHaveBeenCalledWith({
      agentId: AGENT_ID,
      note: 'asked "which surface leads?" and assumed "one"',
    });
  });

  it('writes no provenance at all when every question blocks', async () => {
    const recorded = await recordArtifactAssumptions({
      agentId: AGENT_ID,
      assistantText: question({ text: 'renew the expired key?', blocking: true }),
    });

    expect(recorded).toBe(0);
    expect(appendArtifactProvenanceOmission).not.toHaveBeenCalled();
  });
});
