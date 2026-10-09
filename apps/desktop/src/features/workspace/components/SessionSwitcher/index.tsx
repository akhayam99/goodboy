import { useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { SwitcherPanel } from './SwitcherPanel';
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
      <SwitcherPanel
        sessions={state.ids.map((id) => sessionById(sessions, id))}
        selectedIndex={state.index}
        onChoose={choose}
      />
    </div>
  );
};
