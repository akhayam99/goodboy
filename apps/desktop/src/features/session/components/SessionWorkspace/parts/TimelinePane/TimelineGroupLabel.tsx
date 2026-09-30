import { WORK_ROW, cn, tintClasses } from '@goodboy/ui';

type GroupLabelPart = {
  readonly state: string;
  readonly count: number;
  readonly noun: string;
  readonly isFailure: boolean;
};

type Props = {
  readonly title: string;
  readonly parts: ReadonlyArray<GroupLabelPart>;
};

export const TimelineGroupLabel = ({ title, parts }: Props) => (
  <>
    <span
      title={title}
      className={cn(
        'flex min-w-0 items-center overflow-hidden text-row text-foreground',
        WORK_ROW.title,
      )}
    >
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-pre">{title}</span>
    </span>
    <span
      data-testid="resolve-batch-summary"
      className="min-w-0 truncate text-secondary text-muted-foreground"
    >
      {parts.map((part, index) => (
        <span key={part.state}>
          {index === 0 ? null : (
            <span className="whitespace-pre text-faint-foreground">{' · '}</span>
          )}
          <span className={part.isFailure ? tintClasses('danger').text : undefined}>
            {`${part.count} ${part.noun}`}
          </span>
        </span>
      ))}
    </span>
  </>
);
