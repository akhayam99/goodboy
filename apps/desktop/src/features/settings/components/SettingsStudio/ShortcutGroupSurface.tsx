import { AppWindow, Command, Compass, PanelsTopLeft, type LucideIcon } from 'lucide-react';
import { KbdPill, SectionSurface } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutRangeGlyphs } from '../../../../shared/keyboard/registry';
import type { ShortcutGroup } from '../../../../shared/keyboard/registry';
import { shortcutRows } from './shortcutRows';

const GROUP_LABEL: Readonly<Record<ShortcutGroup, string>> = {
  general: 'General',
  workspaces: 'Workspaces',
  navigate: 'Navigate',
  session: 'Session',
  views: 'Views',
  window: 'Window',
};

const GROUP_ICON: Readonly<Record<ShortcutGroup, LucideIcon>> = {
  general: Command,
  workspaces: CONCEPT_ICONS.workspace,
  navigate: Compass,
  session: CONCEPT_ICONS.sessions,
  views: PanelsTopLeft,
  window: AppWindow,
};

type Props = {
  readonly group: ShortcutGroup;
};

export const ShortcutGroupSurface = ({ group }: Props) => {
  const Icon = GROUP_ICON[group];
  return (
    <SectionSurface
      label={GROUP_LABEL[group]}
      icon={<Icon size={ICON_SIZE.row} aria-hidden />}
      headingLevel={3}
    >
      <ul className="flex flex-col gap-2">
        {shortcutRows({ group }).map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-3 text-label">
            <span className="min-w-0 truncate text-muted-foreground">{row.label}</span>
            <KbdPill className="shrink-0">
              {shortcutRangeGlyphs({ first: row.first, last: row.last })}
            </KbdPill>
          </li>
        ))}
      </ul>
    </SectionSurface>
  );
};
