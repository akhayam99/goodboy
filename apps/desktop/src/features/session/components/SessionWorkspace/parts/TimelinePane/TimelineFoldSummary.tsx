import {
  groupSummaryPartText,
  groupSummaryText,
  type GroupSummary,
  type GroupSummaryPart,
} from '../../../../timeline/groupSummary';

type Props = {
  readonly summary: GroupSummary;
};

const isKept = ({ part }: { readonly part: GroupSummaryPart }): boolean => part.isKept === true;

export const TimelineFoldSummary = ({ summary }: Props) => {
  const [first, ...rest] = summary.parts;
  if (first === undefined) {
    return null;
  }
  const middle = rest.filter((part) => !isKept({ part }));
  const kept = rest.filter((part) => isKept({ part }));
  return (
    <span
      data-testid="fold-summary"
      title={groupSummaryText({ summary })}
      className="flex flex-1 basis-0 whitespace-pre text-meta text-muted-foreground"
    >
      <span className="shrink-0">{groupSummaryPartText({ part: first })}</span>
      {middle.length === 0 ? null : (
        <span className="w-0 max-w-fit flex-1 overflow-hidden text-ellipsis @max-[272px]:hidden">
          {middle.map((part) => (
            <span key={part.state}>
              <span className="text-faint-foreground">{' · '}</span>
              {groupSummaryPartText({ part })}
            </span>
          ))}
        </span>
      )}
      {kept.map((part) => (
        <span key={part.state} className="shrink-0 @max-[272px]:hidden">
          <span className="text-faint-foreground">{' · '}</span>
          {groupSummaryPartText({ part })}
        </span>
      ))}
    </span>
  );
};
