import type { ComponentType } from 'react';
import { aDelegation } from '../../../../../features/auto/testing/autoViewFixtures';
import { SpawnRecord } from '../../../../../features/auto/tree/SpawnRecord';
import { spawnRecordOf } from '../../../../../features/auto/tree/spawnRecordOf';

const base = aDelegation({ key: 'tester', role: 'tester', state: 'settled', outcome: 'completed' });

const RECORD = spawnRecordOf({
  agentId: 'agent-tester',
  number: '4',
  delegations: [
    {
      ...base,
      request: {
        ...base.request,
        task: 'Add a redelivery test for the batch endpoint: a redelivered batch posts one credit per event.',
        reason:
          'You asked to also cover the batch endpoint. The first Tester is busy on POST /webhooks, so a second one takes the batch path.',
        roleFit: 'implementer',
        roleReason: 'the brief adds tests only.',
        doneWhen: 'A redelivered batch posts one credit per event.',
        launchSnapshot: [
          {
            kind: 'note',
            label: 'Also cover the batch endpoint',
            detail: 'your note, read at turn 4',
          },
          {
            kind: 'result',
            label: 'Result of Scout 2.1',
            detail: 'the batch endpoint calls the same guard',
          },
          { kind: 'guidance', label: 'Use pnpm, never npm', detail: 'project guidance' },
        ],
      },
      result: {
        schemaVersion: 1,
        declared: {
          completion: 'done',
          summary: '1 file changed, 7 tests pass, verified by checks',
        },
        verified: { changedFiles: [], checks: [] },
        artifacts: [],
        openQuestions: [],
        cost: { usd: 0.17, basis: 'reported' },
        reason: null,
      },
    },
  ],
});

const WorkLeadRecordScene = () =>
  RECORD === null ? null : (
    <div className="mx-auto h-screen w-[26rem] bg-background text-foreground">
      <SpawnRecord record={RECORD} onClose={() => undefined} onOpenTranscript={() => undefined} />
    </div>
  );

export const U42_WORK_LEAD_RECORD_SCENES: Readonly<Record<string, ComponentType>> = {
  'work-lead-record': WorkLeadRecordScene,
};
