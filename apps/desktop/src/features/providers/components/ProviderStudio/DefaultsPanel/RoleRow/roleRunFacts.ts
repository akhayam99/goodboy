import {
  ROLE_REGISTRY,
  resolveRoleRouting,
  roleSplitLimits,
  type AutoContext,
} from '@goodboy/core';
import type { AgentEffort, AgentRole, ProviderId } from '@goodboy/types';
import { ROLE_LABEL } from '../../../../../session/agent-kind';
import { recommendationSummary } from '../../../../../../shared/components/RoutingPicker/recommendationSummary';
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
  readonly split: Readonly<{ headline: string; note: string }>;
  readonly launch: string;
};

type Params = {
  readonly role: AgentRole;
  readonly autoContext: AutoContext;
  readonly isParallelOn: boolean;
};

const PARALLEL_OFF_NOTE = 'Parallel agents is off in this workspace, so it runs as one agent.';

export const roleRunFacts = ({ role, autoContext, isParallelOn }: Params): RoleRunFacts => {
  const entry = ROLE_REGISTRY[role];
  const auto = resolveRoleRouting({ role, prefs: null, auto: autoContext });
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
      effort: auto.effort,
      label: recommendationSummary({
        provider: auto.provider,
        model: auto.model,
        effort: auto.effort,
      }),
    },
    autoReason: entry.explain.autoReason,
    split: { headline, note },
    launch:
      entry.explain.launchNote ??
      `${ROLE_LABEL[role]}s it starts use the same providers as the parent, filtered by your provider order.`,
  };
};
