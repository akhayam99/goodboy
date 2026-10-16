import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { openPaneOf } from '../../panes/openPaneOf';
import { togglePane } from '../../panes/togglePane';
import { PaneMoreMenu } from './PaneMoreMenu';
import { PaneToggle } from './PaneToggle';

type Props = {
  readonly sessionId: SessionId;
};

export const PaneCluster = ({ sessionId }: Props) => {
  const openPane = useAppStore((state) => openPaneOf({ state, sessionId }));
  return (
    <div
      role="group"
      aria-label="Panes"
      data-testid="pane-cluster"
      className="flex shrink-0 items-center gap-1"
    >
      <PaneToggle
        icon={CONCEPT_ICONS.ask}
        label="Ask"
        tooltip="Ask what is happening in this session"
        shortcut="ask.open"
        isOpen={openPane === 'ask'}
        testId="pane-toggle-ask"
        onToggle={() => togglePane({ sessionId, pane: 'ask' })}
      />
      <PaneToggle
        icon={CONCEPT_ICONS.terminal}
        label="Terminal"
        tooltip="Terminal in this session"
        shortcut="session.terminal"
        isOpen={openPane === 'terminal'}
        testId="pane-toggle-terminal"
        onToggle={() => togglePane({ sessionId, pane: 'terminal' })}
      />
      <PaneToggle
        icon={CONCEPT_ICONS.explore}
        label="Explore"
        tooltip="Browse the files of this session"
        shortcut="lens.explore"
        isOpen={openPane === 'explore'}
        testId="pane-toggle-explore"
        onToggle={() => togglePane({ sessionId, pane: 'explore' })}
      />
      <PaneMoreMenu sessionId={sessionId} openPane={openPane} />
    </div>
  );
};
