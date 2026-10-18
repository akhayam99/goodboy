import { KeyHint, Band } from '@goodboy/ui';
import { NAMES } from '../../../../shared/names';
import { shortcutRangeGlyphs } from '../../../../shared/keyboard/registry';
import type { ShortcutGroup } from '../../../../shared/keyboard/registry';
import { groupWhere, shortcutRows } from './shortcutRows';

const GROUP_LABEL: Readonly<Record<ShortcutGroup, string>> = {
  general: 'General',
  workspaces: 'Workspaces',
  navigate: 'Navigate',
  session: 'Session',
  views: 'Views',
  lists: 'Lists',
  selection: 'Selection',
  review: NAMES.comments,
  diff: NAMES.files,
  window: 'Window',
};

type Props = {
  readonly group: ShortcutGroup;
};

export const ShortcutGroupSurface = ({ group }: Props) => {
  const sharedWhere = groupWhere({ group });
  return (
    <Band
      inset="content"
      label={GROUP_LABEL[group]}
      hint={sharedWhere ?? undefined}
      headingLevel={3}
    >
      <ul className="flex flex-col gap-2">
        {shortcutRows({ group }).map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-3 text-label">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-muted-foreground">{row.label}</span>
              {sharedWhere === null && row.where !== null ? (
                <span className="truncate text-meta text-faint-foreground">{row.where}</span>
              ) : null}
            </span>
            <span className="shrink-0">
              <KeyHint keys={shortcutRangeGlyphs({ first: row.first, last: row.last })} />
            </span>
          </li>
        ))}
      </ul>
    </Band>
  );
};
