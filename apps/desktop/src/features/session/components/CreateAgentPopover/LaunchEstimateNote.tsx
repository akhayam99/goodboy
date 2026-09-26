import { Tooltip } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { estimateKeyOf } from '../../../workTreeModel/agentWorkTime';
import { useLaunchEstimate } from '../../../workTreeModel/hooks/useLaunchEstimate';
import { usualRangeLabel } from '../../../workTreeModel/workTime';
import { KIND_TO_ROLE, type AgentKind, type AgentKindRouting } from '../../agent-kind';

type Props = {
  readonly workspaceId: WorkspaceId | null;
  readonly kind: AgentKind;
  readonly routing: AgentKindRouting;
  readonly isShown: boolean;
};

export const LaunchEstimateNote = ({ workspaceId, kind, routing, isShown }: Props) => {
  const estimate = useLaunchEstimate({
    workspaceId,
    key: estimateKeyOf({
      role: KIND_TO_ROLE[kind],
      provider: routing.provider,
      model: routing.model,
      effort: routing.effort,
      size: null,
    }),
    unit: 'turn',
    isShown,
  });
  if (estimate === null) {
    return null;
  }
  return (
    <Tooltip
      content={`The first turn usually takes ${usualRangeLabel(estimate)}. ${estimate.basis}`}
    >
      <span
        data-testid="launch-estimate"
        className="min-w-0 flex-1 truncate text-secondary tabular-nums text-muted-foreground"
      >
        {`Starts now · usually ${usualRangeLabel(estimate)}`}
      </span>
    </Tooltip>
  );
};
