import { ROLE_REGISTRY, roleSplitLimits, type Resolution } from '@goodboy/core';
import type { AgentEffort, AgentRole, ProviderId } from '@goodboy/types';
import { ROLE_LABEL } from '../../../../../session/agent-kind';
import { recommendationSummary } from '../../../../../../shared/components/RoutingPicker/recommendationSummary';
import {
  routingLabelParts,
  routingNameText,
} from '../../../../../../shared/components/RoutingPicker/routingSummary';
import { pluralize } from '../../../../../../shared/utils/pluralize';

export type RoleRunFacts = {
  readonly does: string;
  readonly auto: Readonly<{
    provider: ProviderId;
    model: string;
    effort: AgentEffort;
    label: string;
  }>;
  readonly autoReason: string;
  readonly bySize: string | null;
  readonly split: Readonly<{ headline: string; note: string }>;
  readonly launch: string;
};

type SizedAutos = Readonly<{
  small: Resolution;
  large: Resolution;
}>;

type Params = {
  readonly role: AgentRole;
  readonly auto: Resolution;
  readonly sized?: SizedAutos;
  readonly isParallelOn: boolean;
};

type SizeLineParams = {
  readonly auto: Resolution;
  readonly sized: SizedAutos;
};

const pickKey = (resolution: Resolution): string =>
  `${resolution.provider}|${resolution.model}|${resolution.effort ?? ''}`;

const sizeLabel = (resolution: Resolution): string => {
  const label = routingLabelParts({
    provider: resolution.provider,
    model: resolution.model,
    effort: resolution.effort ?? AUTO_EFFORT,
  });
  return [routingNameText(label), ...label.detail].join(' ');
};

const sizeLine = ({ auto, sized }: SizeLineParams): string => {
  if (pickKey(sized.small) === pickKey(auto) && pickKey(sized.large) === pickKey(auto)) {
    return `Auto runs it on ${sizeLabel(auto)} whatever the size of the step.`;
  }
  return `Auto sizes it by the step: small ${sizeLabel(sized.small)}, normal ${sizeLabel(auto)}, large ${sizeLabel(sized.large)}.`;
};

const AUTO_EFFORT: AgentEffort = 'medium';

const PARALLEL_OFF_NOTE = 'Parallel agents is off in this workspace, so it runs as one agent.';

export const roleRunFacts = ({ role, auto, sized, isParallelOn }: Params): RoleRunFacts => {
  const entry = ROLE_REGISTRY[role];
  const effort = auto.effort ?? AUTO_EFFORT;
  const limits = roleSplitLimits(role);
  const noun = ROLE_LABEL[role].toLowerCase();
  const headline =
    limits === null
      ? 'Never splits'
      : `Up to ${pluralize(limits.maxChildren, noun)}, ${pluralize(limits.levels, 'level')}`;
  const note =
    limits !== null && !isParallelOn
      ? `${entry.explain.splitNote} ${PARALLEL_OFF_NOTE}`
      : entry.explain.splitNote;
  return {
    does: entry.explain.does,
    auto: {
      provider: auto.provider,
      model: auto.model,
      effort,
      label: recommendationSummary({
        provider: auto.provider,
        model: auto.model,
        effort,
      }),
    },
    autoReason: entry.explain.autoReason,
    bySize: sized === undefined ? null : sizeLine({ auto, sized }),
    split: { headline, note },
    launch:
      entry.explain.launchNote ??
      `${ROLE_LABEL[role]}s it starts use the same providers as the parent, filtered by your provider order.`,
  };
};
