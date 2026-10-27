import { Scrim } from '@goodboy/ui';
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
      <Scrim />
      <SwitcherPanel
        sessions={state.ids.map((id) => sessionById(sessions, id))}
        pinnedCount={state.pinnedCount}
        selectedIndex={state.index}
        onChoose={choose}
      />
    </div>
  );
};
