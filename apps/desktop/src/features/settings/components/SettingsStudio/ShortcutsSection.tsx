import { KbdPill, Eyebrow } from '@goodboy/ui';
import { SHORTCUTS, shortcutGlyphs } from '../../../../shared/keyboard/registry';
import type { ShortcutId, ShortcutPlane } from '../../../../shared/keyboard/registry';

const PLANE_ORDER: ReadonlyArray<ShortcutPlane> = ['app', 'session', 'lens'];

const PLANE_LABELS: Record<ShortcutPlane, string> = {
  app: 'App',
  session: 'Session',
  lens: 'Lens',
};

const SHORTCUT_IDS = Object.keys(SHORTCUTS) as ReadonlyArray<ShortcutId>;

export const SHORTCUT_COUNT = SHORTCUT_IDS.length;

const idsInPlane = (plane: ShortcutPlane): ReadonlyArray<ShortcutId> =>
  SHORTCUT_IDS.filter((id) => SHORTCUTS[id].plane === plane);

export const ShortcutsSection = () => (
  <div id="keyboard-shortcuts-list" className="flex flex-col gap-5">
    {PLANE_ORDER.map((plane) => (
      <div key={plane} className="flex flex-col gap-2">
        <Eyebrow label={PLANE_LABELS[plane]} muted />
        <ul className="grid grid-cols-2 gap-x-10 gap-y-3">
          {idsInPlane(plane).map((id) => (
            <li key={id} className="flex items-center justify-between gap-4 text-xs">
              <span className="min-w-0 truncate text-muted-foreground">{SHORTCUTS[id].label}</span>
              <KbdPill className="shrink-0">{shortcutGlyphs(id)}</KbdPill>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);
