import { Band } from '@goodboy/ui';
import type { ShortcutGroup } from '../../../../shared/keyboard/registry';
import { ShortcutRowKeys } from './ShortcutRowKeys';
import { SHORTCUT_GROUP_LABEL } from './shortcutGroupLabel';
import { groupWhere, shortcutRows } from './shortcutRows';
import type { ShortcutRecorder } from './useShortcutRecorder';

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
      label={SHORTCUT_GROUP_LABEL[group]}
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
            <span className="flex shrink-0 items-center gap-2">
              <ShortcutRowKeys
                row={row}
                isOverridden={Object.hasOwn(overrides, row.first)}
                recorder={recorder}
              />
              {row.also === null ? null : (
                <ShortcutRowKeys
                  row={{
                    ...row,
                    key: row.also,
                    label: `${row.label}, other keys`,
                    first: row.also,
                    last: row.also,
                    also: null,
                  }}
                  isOverridden={Object.hasOwn(overrides, row.also)}
                  recorder={recorder}
                />
              )}
            </span>
          </li>
        ))}
      </ul>
    </Band>
  );
};
