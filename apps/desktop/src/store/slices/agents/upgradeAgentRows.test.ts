// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { upgradeAgentRows } from './upgradeAgentRows';

const WRITER_ID = brandId<AgentId>({ value: 'agent-writer' });
const REVIEWER_ID = brandId<AgentId>({ value: 'agent-reviewer' });
const FIXER_ID = brandId<AgentId>({ value: 'agent-fixer' });

const lightWriter = anAgent({ id: WRITER_ID, name: 'writer', status: 'completed' });
const lightReviewer = anAgent({ id: REVIEWER_ID, name: 'reviewer', status: 'completed' });
const fullWriter = { ...lightWriter, outputSummary: 'Wrote the ledger-core importer.' };
const fullReviewer = { ...lightReviewer, outputSummary: 'Reviewed the importer.' };
const before = [lightWriter, lightReviewer];
const full = [fullWriter, fullReviewer];

describe('upgradeAgentRows', () => {
  it('takes the full list whole when nothing changed while it loaded', () => {
    expect(upgradeAgentRows({ before, now: before, full })).toBe(full);
  });

  it('keeps a row a live write changed, with the summary from the full list', () => {
    const running = { ...lightReviewer, status: 'running' as const };

    const rows = upgradeAgentRows({ before, now: [lightWriter, running], full });

    expect(rows).toEqual([fullWriter, { ...fullReviewer, status: 'running' }]);
  });

  it('keeps a row added while it loaded and drops a row deleted while it loaded', () => {
    const fixer = anAgent({ id: FIXER_ID, name: 'fixer', status: 'running' });

    const rows = upgradeAgentRows({ before, now: [lightWriter, fixer], full });

    expect(rows).toEqual([fullWriter, fixer]);
  });
});
