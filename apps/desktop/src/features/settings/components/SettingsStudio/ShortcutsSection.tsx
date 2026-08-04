import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { KbdPill, SectionHeader } from '@goodboy/ui';
import { SHORTCUTS, shortcutGlyphs } from '../../../../shared/keyboard/registry';
import type { ShortcutId, ShortcutPlane } from '../../../../shared/keyboard/registry';

type Props = {
  readonly initiallyExpanded: boolean;
};

const PLANE_ORDER: ReadonlyArray<ShortcutPlane> = ['app', 'session', 'lens'];

const PLANE_LABELS: Record<ShortcutPlane, string> = {
  app: 'App',
  session: 'Session',
  lens: 'Lens',
};

const SHORTCUT_IDS = Object.keys(SHORTCUTS) as ReadonlyArray<ShortcutId>;

const idsInPlane = (plane: ShortcutPlane): ReadonlyArray<ShortcutId> =>
  SHORTCUT_IDS.filter((id) => SHORTCUTS[id].plane === plane);

export const ShortcutsSection = ({ initiallyExpanded }: Props) => {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);

  useEffect(() => {
    if (initiallyExpanded) {
      setIsExpanded(true);
    }
  }, [initiallyExpanded]);

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        label="Shortcuts"
        action={
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
            aria-controls="keyboard-shortcuts-list"
            aria-label={isExpanded ? 'Collapse keyboard shortcuts' : 'Expand keyboard shortcuts'}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-2xs font-medium text-muted-foreground motion-safe:transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <span className="rounded-full bg-muted px-2 py-0.5">
              {SHORTCUT_IDS.length} shortcuts
            </span>
            {isExpanded ? (
              <ChevronDown size={13} aria-hidden />
            ) : (
              <ChevronRight size={13} aria-hidden />
            )}
          </button>
        }
      />
      {isExpanded ? (
        <div id="keyboard-shortcuts-list" className="flex flex-col gap-5">
          {PLANE_ORDER.map((plane) => (
            <div key={plane} className="flex flex-col gap-2">
              <span className="text-3xs font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
                {PLANE_LABELS[plane]}
              </span>
              <ul className="grid grid-cols-2 gap-x-10 gap-y-3">
                {idsInPlane(plane).map((id) => (
                  <li key={id} className="flex items-center justify-between gap-4 text-xs">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {SHORTCUTS[id].label}
                    </span>
                    <KbdPill className="shrink-0">{shortcutGlyphs(id)}</KbdPill>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
