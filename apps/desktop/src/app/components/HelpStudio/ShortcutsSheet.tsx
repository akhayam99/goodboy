import { Band, Button, KeyHint, PaneShell } from '@goodboy/ui';
import { shortcutRangeGlyphs } from '../../../shared/keyboard/registry';
import { SHORTCUT_GROUP_LABEL } from '../../../features/settings/components/SettingsStudio/shortcutGroupLabel';
import {
  SHORTCUT_COLUMNS,
  groupWhere,
  shortcutRows,
} from '../../../features/settings/components/SettingsStudio/shortcutRows';

type Props = {
  readonly onCustomize: () => void;
};

export const ShortcutsSheet = ({ onCustomize }: Props) => (
  <PaneShell
    page="guideChapter"
    title="Shortcuts"
    meta="Read only"
    actions={
      <Button variant="quiet" size="sm" onClick={onCustomize}>
        Customize in Settings
      </Button>
    }
  >
    <div className="grid grid-cols-2 gap-4">
      {SHORTCUT_COLUMNS.map((column) => (
        <div key={column.join('-')} className="flex min-w-0 flex-col gap-4">
          {column.map((group) => {
            const sharedWhere = groupWhere({ group });
            return (
              <div key={group} id={`help-shortcuts-${group}`}>
                <Band
                  inset="content"
                  label={SHORTCUT_GROUP_LABEL[group]}
                  hint={sharedWhere ?? undefined}
                  headingLevel={2}
                >
                  <ul className="flex flex-col gap-2">
                    {shortcutRows({ group }).map((row) => (
                      <li
                        key={row.key}
                        className="flex items-center justify-between gap-3 text-meta"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-muted-foreground">{row.label}</span>
                          {sharedWhere === null && row.where !== null ? (
                            <span className="truncate text-meta text-faint-foreground">
                              {row.where}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0">
                          <KeyHint
                            keys={shortcutRangeGlyphs({ first: row.first, last: row.last })}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                </Band>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  </PaneShell>
);
