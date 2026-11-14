// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type AutoTreeId, type SessionId } from '@goodboy/types';
import { aView } from '../../auto/testing/autoViewFixtures';
import type { WorkLead } from '../../../store/slices/work/state';
import { workRowsOf } from '../../work/workRowsOf';
import { leadEntries } from './leadEntries';

const leadOf = ({ key }: { readonly key: string }): WorkLead => {
  const base = aView({ phase: 'deciding', rootAsk: `Ask ${key}` });
  const treeId = brandId<AutoTreeId>({ value: `tree-${key}` });
  return {
    treeId,
    sessionId: brandId<SessionId>({ value: `session-${key}` }),
    sessionGoal: `Goal ${key}`,
    projectId: null,
    branches: ['harborline/one', 'harborline/two'],
    view: {
      ...base,
      tree: { ...base.tree, id: treeId, rootAgentId: brandId<AgentId>({ value: `agent-${key}` }) },
    },
  };
};

describe('the Lead entries of the palette', () => {
  it('lists each open Lead once, even when it worked on two branches', () => {
    const leads = [leadOf({ key: 'a' }), leadOf({ key: 'b' })];
    const { rows } = workRowsOf({ leads, rootTurns: {}, filter: 'open', isWork: true });

    const entries = leadEntries({ rows: [...rows, ...rows], open: vi.fn() });

    expect(entries.map((entry) => entry.label).sort()).toEqual(['Lead: Ask a', 'Lead: Ask b']);
    expect(new Set(entries.map((entry) => entry.key)).size).toBe(2);
  });

  it('opens the Lead page of the session through the resolver', () => {
    const open = vi.fn();
    const { rows } = workRowsOf({
      leads: [leadOf({ key: 'a' })],
      rootTurns: {},
      filter: 'open',
      isWork: true,
    });

    leadEntries({ rows, open })[0]?.run();

    expect(open).toHaveBeenCalledWith({ sessionId: 'session-a', agentId: 'agent-a' });
  });
});
