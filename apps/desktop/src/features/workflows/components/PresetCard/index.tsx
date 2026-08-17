import { ClampedProse, SelectableRow } from '@goodboy/ui';
import type { Workflow } from '@goodboy/types';
import { inferAgentKindFromName, ROLE_TO_KIND } from '../../../session/agent-kind';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { WorkflowOriginTag } from '../WorkflowOriginTag';

type Props = {
  readonly template: Workflow;
  readonly active: boolean;
  readonly onSelect: () => void;
};

export const PresetCard = ({ template, active, onSelect }: Props) => {
  const steps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
  const description = template.description?.trim();
  return (
    <li>
      <SelectableRow
        selected={active}
        ariaCurrent={active}
        onClick={onSelect}
        className="flex-col gap-1.5 px-2.5 py-2"
      >
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium text-foreground">{template.name}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            {template.origin != null ? <WorkflowOriginTag origin={template.origin} /> : null}
            <span className="text-2xs tabular-nums text-muted-foreground/50">
              {steps.length} {steps.length === 1 ? 'step' : 'steps'}
            </span>
          </span>
        </div>
        {steps.length > 0 ? (
          <span className="flex flex-wrap items-center gap-2 pr-8">
            {steps.map((step) => {
              const kind = step.role ? ROLE_TO_KIND[step.role] : inferAgentKindFromName(step.name);
              return <AgentAvatar key={step.id} kind={kind} size="xs" title={step.name} />;
            })}
          </span>
        ) : null}
      </SelectableRow>
      {description ? (
        <div className="px-2.5 py-1">
          <ClampedProse
            text={description}
            lines={2}
            className="text-2xs text-muted-foreground/70"
          />
        </div>
      ) : null}
    </li>
  );
};
