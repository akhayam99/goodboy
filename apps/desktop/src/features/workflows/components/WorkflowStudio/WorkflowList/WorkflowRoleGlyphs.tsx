import type { Workflow } from '@goodboy/types';
import { TEXT_ROLE, cn } from '@goodboy/ui';
import { classifyStep } from '../../../../session/agent-kind';
import { AgentKindChip } from '../../../../../shared/components/AgentKindChip';

type Props = {
  readonly workflow: Workflow;
};

const MAX_GLYPHS = 6;

export const WorkflowRoleGlyphs = ({ workflow }: Props) => {
  const steps = [...workflow.steps]
    .filter((step) => step.deletedAt == null)
    .sort((left, right) => left.ordinal - right.ordinal);
  const shown = steps.slice(0, MAX_GLYPHS);
  const hidden = steps.length - shown.length;
  return (
    <span className="flex min-w-0 items-center gap-1" aria-hidden>
      {shown.map((step) => (
        <AgentKindChip key={step.id} kind={classifyStep({ step })} density="glyph" isDecorative />
      ))}
      {hidden > 0 ? (
        <span className={cn('tabular-nums', TEXT_ROLE.hint)}>{`+${hidden}`}</span>
      ) : null}
    </span>
  );
};
