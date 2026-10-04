import type { Workflow } from '@goodboy/types';
import { classifyStep } from '../../../../session/agent-kind';
import { AgentKindChip } from '../../../../../shared/components/AgentKindChip';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { formatSpan } from '../../../../../shared/utils/time/formatSpan';
import type { BuiltinWorkflowState } from '../../../builtinWorkflowState';
import { useNow } from '../../../../../shared/hooks/useNow';

type Props = {
  readonly workflow: Workflow;
  readonly builtin: BuiltinWorkflowState;
  readonly onOpen: () => void;
};

const MAX_ROLE_CHIPS = 6;

type MetaParams = {
  readonly workflow: Workflow;
  readonly builtin: BuiltinWorkflowState;
  readonly now: number;
};

const metaOf = ({ workflow, builtin, now }: MetaParams): string => {
  const count = workflow.steps.length;
  const steps = `${count} ${count === 1 ? 'step' : 'steps'}`;
  if (builtin === 'builtin') {
    return `${steps} · built in`;
  }
  const age = formatSpan({ from: workflow.updatedAt, to: now });
  return age === '' ? steps : `${steps} · edited ${age} ago`;
};

export const WorkflowListRow = ({ workflow, builtin, onOpen }: Props) => {
  const now = useNow(30_000);
  const steps = [...workflow.steps].sort((left, right) => left.ordinal - right.ordinal);
  const shown = steps.slice(0, MAX_ROLE_CHIPS);
  const hidden = steps.length - shown.length;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${workflow.name}`}
        className="group flex h-9 w-full min-w-0 items-center gap-3 rounded-md px-2 text-left transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <CONCEPT_ICONS.workflows
          size={ICON_SIZE.control}
          aria-hidden
          className="shrink-0 text-faint-foreground"
        />
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-body text-foreground">{workflow.name}</span>
          {builtin === 'custom' ? null : (
            <span className="shrink-0 text-eyebrow text-faint-foreground">Built in</span>
          )}
          {builtin === 'edited' ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-meta text-warning">
              <span aria-hidden className="size-1.5 rounded-full bg-warning" />
              Edited
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-2" aria-hidden>
          {shown.map((step) => (
            <AgentKindChip
              key={step.id}
              kind={classifyStep({ step })}
              density="glyph"
              title={step.name}
            />
          ))}
          {hidden > 0 ? (
            <span className="text-meta tabular-nums text-faint-foreground">{`+${hidden}`}</span>
          ) : null}
        </span>
        <span className="w-36 shrink-0 truncate text-right text-meta tabular-nums text-faint-foreground">
          {metaOf({ workflow, builtin, now })}
        </span>
      </button>
    </li>
  );
};
