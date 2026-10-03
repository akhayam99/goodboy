import {
  AppWindow,
  Command,
  Compass,
  List,
  ListChecks,
  PanelsTopLeft,
  type LucideIcon,
} from 'lucide-react';
import { KbdPill, Band } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
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
  review: 'Review',
  diff: 'Diff',
  window: 'Window',
};

const GROUP_ICON: Readonly<Record<ShortcutGroup, LucideIcon>> = {
  general: Command,
  workspaces: CONCEPT_ICONS.workspace,
  navigate: Compass,
  session: CONCEPT_ICONS.sessions,
  views: PanelsTopLeft,
  lists: List,
  selection: ListChecks,
  review: CONCEPT_ICONS.review,
  diff: CONCEPT_ICONS.diff,
  window: AppWindow,
};

type Props = {
  readonly group: ShortcutGroup;
};

export const ShortcutGroupSurface = ({ group }: Props) => {
  const Icon = GROUP_ICON[group];
  const sharedWhere = groupWhere({ group });
  return (
    <Band
      inset="content"
      label={GROUP_LABEL[group]}
      icon={<Icon size={ICON_SIZE.row} aria-hidden />}
      hint={sharedWhere ?? undefined}
      headingLevel={3}
    >
      <ul className="flex flex-col gap-2">
        {shortcutRows({ group }).map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-3 text-label">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-muted-foreground">{row.label}</span>
              {sharedWhere === null && row.where !== null ? (
                <span className="truncate text-secondary text-faint-foreground">{row.where}</span>
              ) : null}
            </span>
            <KbdPill className="shrink-0">
              {shortcutRangeGlyphs({ first: row.first, last: row.last })}
            </KbdPill>
          </li>
        ))}
      </ul>
    </Band>
  );
};
