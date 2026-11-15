import type { ComponentType } from 'react';
import { IMPLEMENTER_ID, type AutoSceneData } from '../../u24/autoSceneSeed';
import { RunPageScene } from './RunPageScene';
import { runTraceSceneOf } from './runTraceSceneOf';

type SceneParams = {
  readonly scene: AutoSceneData;
};

const WENT_IN = {
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
};

const leadAgentSceneOf = ({ scene }: SceneParams): AutoSceneData => {
  const traced = runTraceSceneOf({ scene });
  const [head] = traced.view.delegations
    .filter((delegation) => delegation.childAgentId === IMPLEMENTER_ID)
    .sort((left, right) => right.createdAt - left.createdAt);
  if (head === undefined) {
    return traced;
  }
  return {
    ...traced,
    view: {
      ...traced.view,
      launchSnapshots: { ...traced.view.launchSnapshots, [head.id]: WENT_IN },
    },
  };
};

export const RUN_LEAD_AGENT_SCENES = {
  'run-page-lead-agent': () => (
    <RunPageScene
      state="working"
      theme="dark"
      isLead
      extend={leadAgentSceneOf}
      shownAgentId={IMPLEMENTER_ID}
    />
  ),
} satisfies Readonly<Record<string, ComponentType>>;
