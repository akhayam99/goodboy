import type { ComponentType } from 'react';
import type { AgentId, AutoRouting, AutoRoutingCandidate } from '@goodboy/types';
import { RunPageScene } from '../surfaces/run-page/RunPageScene';
import { runTraceSceneOf } from '../surfaces/run-page/runTraceSceneOf';
import { IMPLEMENTER_ID, TESTER_ID, type AutoSceneData } from '../u24/autoSceneSeed';

const CLAUDE_SONNET: AutoRoutingCandidate = {
  provider: 'anthropic',
  model: 'sonnet-5.5',
  effort: 'medium',
  order: 1,
  isLighter: false,
  room: { usedPercent: 62, isEstimated: false },
  load: 3,
  cause: null,
};
const CLAUDE_HAIKU: AutoRoutingCandidate = {
  ...CLAUDE_SONNET,
  model: 'haiku-5.5',
  isLighter: true,
};
const CODEX_SOL: AutoRoutingCandidate = {
  ...CLAUDE_SONNET,
  provider: 'codex',
  model: 'gpt-6.1-sol',
  order: 3,
  room: { usedPercent: 18, isEstimated: false },
  load: 2,
};
const CODEX_LUNA: AutoRoutingCandidate = { ...CODEX_SOL, model: 'gpt-6.1-luna', isLighter: true };
const CURSOR_WRITER: AutoRoutingCandidate = {
  ...CLAUDE_SONNET,
  provider: 'cursor',
  order: 2,
  room: { usedPercent: 40, isEstimated: true },
  load: 1,
  cause: 'writer',
};

const LEAD_PICK: AutoRouting = {
  provider: 'codex',
  model: 'gpt-6.1-sol',
  effort: 'medium',
  reason:
    'A standard step that Sol handles well, and Claude is at 62%, so I keep it for the review.',
  proposal: 'kept',
  source: 'lead',
  candidates: [CLAUDE_SONNET, CLAUDE_HAIKU, CODEX_SOL, CODEX_LUNA, CURSOR_WRITER],
  requested: { provider: 'codex', model: 'gpt-6.1-sol', effort: 'medium' },
  modelReason:
    'A standard step that Sol handles well, and Claude is at 62%, so I keep it for the review.',
};

const MOVED_PICK: AutoRouting = {
  provider: 'anthropic',
  model: 'sonnet-5.5',
  effort: 'medium',
  reason:
    'The Lead asked for Cursor Sonnet 5.5: agents that write code do not run here yet. Claude: first in your order.',
  proposal: 'replaced',
  source: 'fallback',
  cause: 'writer',
  candidates: [CLAUDE_SONNET, CLAUDE_HAIKU, CODEX_SOL, CURSOR_WRITER],
  requested: { provider: 'cursor', model: 'sonnet-5.5', effort: 'medium' },
  modelReason: 'Cursor has room and Sonnet fits a standard test.',
};

type PickParams = {
  readonly scene: AutoSceneData;
  readonly agentId: AgentId;
  readonly routing: AutoRouting;
};

const withPick = ({ scene, agentId, routing }: PickParams): AutoSceneData => {
  const traced = runTraceSceneOf({ scene });
  return {
    ...traced,
    view: {
      ...traced.view,
      delegations: traced.view.delegations.map((delegation) =>
        delegation.childAgentId === agentId
          ? {
              ...delegation,
              request: { ...delegation.request, difficulty: 'standard' },
              routing,
            }
          : delegation,
      ),
    },
  };
};

type SceneParams = {
  readonly scene: AutoSceneData;
};

const leadPickOf = ({ scene }: SceneParams): AutoSceneData =>
  withPick({ scene, agentId: IMPLEMENTER_ID, routing: LEAD_PICK });

const movedPickOf = ({ scene }: SceneParams): AutoSceneData =>
  withPick({ scene, agentId: TESTER_ID, routing: MOVED_PICK });

export const U53_AGENT_WHY_SCENES = {
  'u53-agent-lead-pick': () => (
    <RunPageScene
      state="working"
      theme="dark"
      isLead
      extend={leadPickOf}
      shownAgentId={IMPLEMENTER_ID}
    />
  ),
  'u53-agent-lead-pick-light': () => (
    <RunPageScene
      state="working"
      theme="light"
      isLead
      extend={leadPickOf}
      shownAgentId={IMPLEMENTER_ID}
    />
  ),
  'u53-agent-moved-pick': () => (
    <RunPageScene
      state="working"
      theme="dark"
      isLead
      extend={movedPickOf}
      shownAgentId={TESTER_ID}
    />
  ),
} satisfies Readonly<Record<string, ComponentType>>;
