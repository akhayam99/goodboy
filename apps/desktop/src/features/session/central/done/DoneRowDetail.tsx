import { Button, HeaderActions, formatUsd } from '@goodboy/ui';
import { AutoAgentGroup } from '../../../auto/group/AutoAgentGroup';
import type { TimelineOpenTarget } from '../../hooks/useTimelineOpen';
import type { DoneRowModel, DoneRowParams } from './doneTypes';

type Props = {
  readonly row: DoneRowModel;
  readonly openTarget: TimelineOpenTarget | null;
  readonly onShowInLog: () => void;
};

type Fact = {
  readonly label: string;
  readonly value: string;
};

const factsOf = ({ row }: DoneRowParams): ReadonlyArray<Fact> => {
  const { model, effort, duration, costUsd } = row.detail;
  const facts: Array<Fact> = [];
  if (model !== null) {
    facts.push({ label: 'Model', value: model });
  }
  if (effort !== null) {
    facts.push({ label: 'Effort', value: effort });
  }
  if (duration !== null) {
    facts.push({ label: 'Time', value: duration });
  }
  if (costUsd !== null) {
    facts.push({ label: 'Cost', value: formatUsd(costUsd) });
  }
  return facts;
};

export const DoneRowDetail = ({ row, openTarget, onShowInLog }: Props) => {
  const facts = factsOf({ row });
  const { steps, auto, branches, fullText } = row.detail;
  return (
    <div
      data-done-detail={row.id}
      className="grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 rounded-md bg-subtle p-2"
    >
      <span aria-hidden />
      <div className="flex min-w-0 flex-col gap-2">
        {facts.length === 0 ? null : (
          <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-label">
            {facts.flatMap((fact) => [
              <dt key={`${fact.label}-term`} className="text-muted-foreground">
                {fact.label}
              </dt>,
              <dd key={`${fact.label}-value`} className="min-w-0 truncate text-foreground">
                {fact.value}
              </dd>,
            ])}
          </dl>
        )}
        {fullText === null ? null : (
          <p
            data-done-full-text=""
            className="min-w-0 whitespace-pre-line text-label text-foreground"
          >
            {fullText}
          </p>
        )}
        {steps.length === 0 ? null : (
          <ol aria-label="Steps" className="flex min-w-0 list-none flex-col gap-1">
            {steps.map((step) => (
              <li key={step.id} className="flex min-w-0 items-baseline gap-2 text-label">
                <span className="shrink-0 text-muted-foreground">{step.role}</span>
                <span className="min-w-0 flex-1 truncate text-foreground">{step.title}</span>
                <span className="shrink-0 text-meta text-faint-foreground">
                  {[step.model, step.effort, step.duration]
                    .filter((part) => part !== null)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ol>
        )}
        {branches.length === 0 ? null : (
          <ol aria-label="Branches" className="flex min-w-0 list-none flex-col gap-1">
            {branches.map((line) => (
              <li key={line.id} className="flex min-w-0 items-baseline gap-2 text-label">
                {line.project === null ? null : (
                  <span className="shrink-0 text-muted-foreground">{line.project}</span>
                )}
                <span className="min-w-0 flex-1 truncate text-foreground">{line.branch}</span>
                <span className="shrink-0 text-meta text-faint-foreground">{line.fact}</span>
              </li>
            ))}
          </ol>
        )}
        {auto === null ? null : <AutoAgentGroup group={auto} isCompact={false} />}
        <HeaderActions
          secondary={
            openTarget === null ? null : (
              <Button size="sm" variant="secondary" onClick={openTarget.open}>
                Open
              </Button>
            )
          }
          button={
            <Button size="sm" variant="secondary" onClick={onShowInLog}>
              Show in log
            </Button>
          }
        />
      </div>
    </div>
  );
};
