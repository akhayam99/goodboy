import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';

type Props = {
  readonly names: ReadonlyArray<string>;
};

const NAME_LIST = new Intl.ListFormat('en', { type: 'conjunction' });

export const TimelineRowWorktrees = ({ names }: Props) => {
  if (names.length === 0) {
    return null;
  }
  const title = `Changed files in ${NAME_LIST.format(names)}`;
  return (
    <span
      data-testid="timeline-row-worktrees"
      title={title}
      aria-label={title}
      className="inline-flex shrink-0 items-center gap-0.5 text-2xs leading-4 tabular-nums text-muted-foreground"
    >
      <CONCEPT_ICONS.worktree size={10} aria-hidden className="shrink-0 text-faint-foreground" />
      {names.length}
    </span>
  );
};
