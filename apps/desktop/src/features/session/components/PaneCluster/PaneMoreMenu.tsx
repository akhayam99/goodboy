import { useEffect } from 'react';
import { Ellipsis } from 'lucide-react';
import { StatusDot } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore, useSummarizerStatus } from '../../../../store';
import { selectHasContextChange } from '../../../../store/slices/contextDrawer/selectHasContextChange';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { PaneClusterMenu } from '../../../actions/PaneClusterMenu';
import type { ClusterPane } from '../../panes/clusterPane';
import { contextNoteOf } from './contextNote';

type Props = {
  readonly sessionId: SessionId;
  readonly openPane: ClusterPane | null;
};

export const PaneMoreMenu = ({ sessionId, openPane }: Props) => {
  const { status } = useSummarizerStatus(sessionId);
  const isContextOpen = openPane === 'context';
  const hasChange = useAppStore(
    (state) => !isContextOpen && selectHasContextChange({ state, sessionId }),
  );
  const hasLedger = useAppStore((state) => state.sessionDecisions[sessionId] !== undefined);
  const loadSessionContextSeen = useAppStore((state) => state.loadSessionContextSeen);
  const loadSessionDecisions = useAppStore((state) => state.loadSessionDecisions);

  useEffect(() => {
    void loadSessionContextSeen(sessionId);
  }, [loadSessionContextSeen, sessionId]);

  useEffect(() => {
    if (hasLedger) {
      return;
    }
    void loadSessionDecisions(sessionId);
  }, [hasLedger, loadSessionDecisions, sessionId]);

  const note = contextNoteOf({ status, hasChange });
  const hasSignal = note !== null;
  const isRareOpen = openPane === 'context' || openPane === 'scripts';

  return (
    <PaneClusterMenu
      facts={{ sessionId, hasContextFailed: status === 'error', contextNote: note }}
      label={hasSignal ? `More panes: ${note}` : 'More panes'}
      triggerClassName={isRareOpen ? 'bg-selected text-foreground' : undefined}
      trigger={
        <span className="relative flex items-center" data-testid="pane-more">
          <Ellipsis size={ICON_SIZE.row} aria-hidden />
          {hasSignal ? (
            <span
              aria-hidden
              data-testid="pane-more-signal"
              data-signal={status === 'idle' ? 'changed' : status}
              className="absolute -top-1 -right-1 flex"
            >
              <StatusDot
                tone={status === 'error' ? 'danger' : 'info'}
                size="sm"
                pulsing={status === 'running'}
              />
            </span>
          ) : null}
        </span>
      }
    />
  );
};
