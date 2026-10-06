import { Eyebrow } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { SwitcherRow } from './SwitcherRow';
import { useNextNeedsYouShortcut } from './useNextNeedsYouShortcut';
import { useSessionSwitcher } from './useSessionSwitcher';

export const SessionSwitcher = () => {
  const { state, choose } = useSessionSwitcher();
  useNextNeedsYouShortcut();
  const sessions = useAppStore((s) => s.sessions);
  if (state === null || !state.isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-command-palette flex items-start justify-center px-4 pt-16">
      <div aria-hidden className="absolute inset-0 bg-scrim motion-safe:animate-fade-in" />
      <div className="relative flex w-full max-w-105 flex-col gap-1 rounded-lg border border-border bg-floating p-2 shadow-lg motion-safe:animate-studio-in">
        <Eyebrow label="Recent sessions" muted className="px-3 pb-1 pt-1" />
        <div role="listbox" aria-label="Recent sessions" className="flex flex-col">
          {state.ids.map((id, index) => {
            const session = sessionById(sessions, id);
            return session === undefined ? null : (
              <SwitcherRow
                key={id}
                session={session}
                isSelected={index === state.index}
                onChoose={() => choose(index)}
              />
            );
          })}
        </div>
        <div className="flex gap-3 px-3 pb-1 pt-2 text-chip text-faint-foreground">
          <span>{shortcutGlyphs('session.switcher')} next</span>
          <span>{shortcutGlyphs('session.switcherBack')} back</span>
          <span>Release to open</span>
          <span>Esc cancel</span>
        </div>
      </div>
    </div>
  );
};
