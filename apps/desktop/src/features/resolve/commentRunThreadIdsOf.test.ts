import { describe, expect, it } from 'vitest';
import type { Agent, AgentStatus } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { agentIdOf } from '../../__tests__/helpers/brandedIds';
import { SESSION_ID } from '../../app/components/MockScene/scenes/resolveSeed';
import { commentRunThreadIdsOf } from './commentRunThreadIdsOf';

const THREAD = 'PRRT_harborline_ledger_layout';

const runOf = ({ status }: { readonly status: AgentStatus }): Agent =>
  anAgent({
    id: agentIdOf({ value: 'run-analysis' }),
    sessionId: SESSION_ID,
    ordinal: 1,
    name: 'Analyze comments',
    status,
    kind: 'auto',
    sourceKind: 'comment_run',
    sourceThreadIds: [THREAD],
  });

describe('commentRunThreadIdsOf holds only the threads a run is still working on', () => {
  it.each<AgentStatus>(['pending', 'running', 'blocked'])(
    'holds a thread of a %s run',
    (status) => {
      expect(commentRunThreadIdsOf({ agents: [runOf({ status })] })).toEqual([THREAD]);
    },
  );

  it.each<AgentStatus>(['completed', 'stopped', 'failed', 'skipped'])(
    'frees a thread of a %s run',
    (status) => {
      expect(commentRunThreadIdsOf({ agents: [runOf({ status })] })).toEqual([]);
    },
  );
});
