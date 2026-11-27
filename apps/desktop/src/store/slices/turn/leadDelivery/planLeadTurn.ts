import {
  deliverySentOf,
  LEAD_DELIVERY_HEADER,
  leadDeliveryDeltaOf,
  leadDeliveryModeOf,
  type LeadDeliveryMode,
  type LeadDeliveryPart,
  type LeadLastTurn,
} from '@goodboy/core/auto';
import { composeHandoffBody, type HandoffBodyLayers } from '@goodboy/core/handoff';
import type { AgentId } from '@goodboy/types';
import { leadDeliveryMemory } from './leadDeliveryMemory';

export type LeadTurn = Readonly<{
  mode: LeadDeliveryMode;
  prompt: string;
}>;

export type PlanLeadTurnParams = Readonly<{
  agentId: AgentId;
  runId: string;
  resumeSessionId: string | null;
  lastTurn: LeadLastTurn | null;
  model: string;
  nowMs: number;
  delivery: ReadonlyArray<LeadDeliveryPart>;
  content: string;
  layers: HandoffBodyLayers;
  preamble: ReadonlyArray<LeadDeliveryPart>;
  candidates: string | null;
}>;

type JoinParams = {
  readonly blocks: ReadonlyArray<string>;
};

const joinBlocks = ({ blocks }: JoinParams): string =>
  blocks.filter((block) => block !== '').join('\n\n');

export const planLeadTurn = ({
  agentId,
  runId,
  resumeSessionId,
  lastTurn,
  model,
  nowMs,
  delivery,
  content,
  layers,
  preamble,
  candidates,
}: PlanLeadTurnParams): LeadTurn => {
  const baseline = leadDeliveryMemory.baselineOf({ agentId });
  const statics: ReadonlyArray<LeadDeliveryPart> = [
    { name: 'verbosity', kind: 'state', text: layers.verbosity },
    { name: 'attachments', kind: 'state', text: layers.goalAttachments },
    { name: 'routing', kind: 'state', text: layers.childRouting },
    ...preamble,
  ];
  const candidatesPart: LeadDeliveryPart = {
    name: 'candidates',
    kind: 'state',
    text: candidates ?? '',
  };
  const mode = leadDeliveryModeOf({
    resumeSessionId,
    baselineSessionId: baseline?.sessionId ?? null,
    lastTurn,
    model,
    nowMs,
  });
  leadDeliveryMemory.begin({
    agentId,
    runId,
    sent: deliverySentOf({ parts: [...statics, ...delivery, candidatesPart] }),
    isFresh: mode === 'fresh',
  });
  const full = joinBlocks({ blocks: [composeHandoffBody(layers), candidatesPart.text] });
  if (mode === 'fresh') {
    return { mode, prompt: joinBlocks({ blocks: [LEAD_DELIVERY_HEADER.fresh, full] }) };
  }
  if (mode === 'full' || baseline === null || content === '' || !layers.message.includes(content)) {
    return { mode: 'full', prompt: full };
  }
  const deltaDelivery = leadDeliveryDeltaOf({ parts: delivery, sent: baseline.sent });
  return {
    mode,
    prompt: joinBlocks({
      blocks: [
        LEAD_DELIVERY_HEADER.delta,
        leadDeliveryDeltaOf({ parts: statics, sent: baseline.sent }),
        layers.message.replace(content, () => deltaDelivery),
        leadDeliveryDeltaOf({ parts: [candidatesPart], sent: baseline.sent }),
      ],
    }),
  };
};
