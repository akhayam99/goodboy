import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';

type Props = {
  readonly names: ReadonlyArray<string>;
};

const VISIBLE_NAMES = 2;
const NAME_LIST = new Intl.ListFormat('en', { type: 'conjunction' });

export const TimelineRowWorktrees = ({ names }: Props) => {
  if (names.length === 0) {
    return null;
  }
  const shown = names.slice(0, VISIBLE_NAMES).join(', ');
  const hidden = names.length - VISIBLE_NAMES;
  return (
    <span
      data-testid="timeline-row-worktrees"
      title={`Changed files in ${NAME_LIST.format(names)}`}
      className="inline-flex min-w-0 shrink items-center gap-1 text-2xs leading-4 text-muted-foreground"
    >
      <CONCEPT_ICONS.worktree size={10} aria-hidden className="shrink-0 text-faint-foreground" />
      <span className="min-w-0 truncate">{shown}</span>
      {hidden > 0 ? <span className="shrink-0 tabular-nums">{`+${hidden}`}</span> : null}
    </span>
  );
};
