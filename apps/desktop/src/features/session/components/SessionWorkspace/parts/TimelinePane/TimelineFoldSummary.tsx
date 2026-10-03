import { groupSummaryText, type GroupSummary } from '../../../../timeline/groupSummary';

type Props = {
  readonly summary: GroupSummary;
};

export const TimelineFoldSummary = ({ summary }: Props) => {
  const [first, ...rest] = summary.parts;
  if (first === undefined) {
    return null;
  }
  return (
    <span
      data-testid="fold-summary"
      title={groupSummaryText({ summary })}
      className="flex flex-1 basis-0 whitespace-pre text-secondary text-muted-foreground"
    >
      <span className="shrink-0">{`${first.count} ${first.noun}`}</span>
      {rest.length === 0 ? null : (
        <span className="w-0 flex-1 overflow-hidden text-ellipsis @max-[272px]:hidden">
          {rest.map((part) => (
            <span key={part.state}>
              <span className="text-faint-foreground">{' · '}</span>
              {`${part.count} ${part.noun}`}
            </span>
          ))}
        </span>
      )}
    </span>
  );
};
