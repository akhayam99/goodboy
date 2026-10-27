import { Band } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import type { ShortcutGroup } from '../../../../shared/keyboard/registry';
import { ShortcutRowKeys } from './ShortcutRowKeys';
import { groupWhere, shortcutRows } from './shortcutRows';
import type { ShortcutRecorder } from './useShortcutRecorder';

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
  readonly overrides: Readonly<Record<string, string>>;
  readonly recorder: ShortcutRecorder;
};

export const ShortcutGroupSurface = ({ group, overrides, recorder }: Props) => {
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
          <li
            key={row.key}
            className="group/shortcut flex items-center justify-between gap-3 text-meta"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-muted-foreground">{row.label}</span>
              {sharedWhere === null && row.where !== null ? (
                <span className="truncate text-meta text-faint-foreground">{row.where}</span>
              ) : null}
            </span>
            <ShortcutRowKeys
              row={row}
              isOverridden={Object.hasOwn(overrides, row.first)}
              recorder={recorder}
            />
          </li>
        ))}
      </ul>
    </Band>
  );
};
