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
  launchSnapshots: {
    [base.id]: {
      schemaVersion: 1,
      items: [
        {
          kind: 'note',
          ref: 'outbox-user-4',
          version: null,
          label: 'Also cover the batch endpoint',
          detail: 'your note, read at turn 4',
        },
        {
          kind: 'image',
          ref: 'attachment-batch',
          version: null,
          label: 'batch-redelivery.png',
          detail: 'an image you sent',
        },
        {
          kind: 'artifact',
          ref: 'artifact-plan@2',
          version: 2,
          label: 'Idempotent webhooks in payments-api',
          detail: 'plan, version 2',
        },
        {
          kind: 'guidance',
          ref: 'guidance',
          version: null,
          label: 'Use pnpm, never npm',
          detail: 'run guidance',
        },
      ],
      images: [],
      routing: { provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'high' },
    },
  },
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
