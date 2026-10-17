import type { Workflow } from '@goodboy/types';
import { TEXT_ROLE, cn } from '@goodboy/ui';
import { AGENT_KIND_META, classifyStep } from '../../../../session/agent-kind';

type Props = {
  readonly workflow: Workflow;
};

const NAMED_ROLES = 2;

export const WorkflowRoleNames = ({ workflow }: Props) => {
  const roles = [
    ...new Set(
      [...workflow.steps]
        .filter((step) => step.deletedAt == null)
        .sort((left, right) => left.ordinal - right.ordinal)
        .map((step) => AGENT_KIND_META[classifyStep({ step })].noun),
    ),
  ];
  const named = roles.slice(0, NAMED_ROLES).join(', ');
  const hidden = roles.length - NAMED_ROLES;
  return (
    <span data-workflow-roles="" className={cn('min-w-0 truncate', TEXT_ROLE.hint)}>
      {hidden > 0 ? `${named} +${hidden}` : named}
    </span>
  );
};
