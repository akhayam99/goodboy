import { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ScrollFade, StudioRailLayout, useStudioRailFold } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { agentPlace } from '../../../../store/slices/navigation/place';
import { leadAgentCountOf } from '../../../auto/tree/leadAgentCountOf';
import type { LeadTreeItem } from '../../../auto/tree/leadTreeItemsOf';
import { LeadTree } from '../LeadTree';
import { RunAgentsRailHead } from './RunAgentsRailHead';
import { useKeepTreeFocus } from './useKeepTreeFocus';
import type { LeadTreeRootState } from '../../../auto/tree/leadTreeRootState';
import { useRunRailRoot } from './useRunRailRoot';
import { NAMES } from '../../../../shared/utils/names';

type Props = {
  readonly host: HTMLElement | null;
  readonly pane: HTMLElement | null;
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly shownAgentId: AgentId;
  readonly items: ReadonlyArray<LeadTreeItem>;
  readonly rootState: LeadTreeRootState | null;
  readonly onEditNote: (noteId: string) => void;
  readonly onRemoveNote: (noteId: string) => void;
};

const RUN_AGENTS_RAIL_SURFACE = 'run-agents';

const RAIL_MAX_PX = 560;

const FRAME_FOLD_BELOW_PX = 1060;

export const RunAgentsRail = ({
  host,
  pane,
  sessionId,
  rootAgentId,
  shownAgentId,
  items,
  rootState,
  onEditNote,
  onRemoveNote,
}: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const root = useRunRailRoot({ sessionId, rootAgentId, state: rootState });
  const fold = useStudioRailFold({
    surface: RUN_AGENTS_RAIL_SURFACE,
    pane,
    foldBelow: FRAME_FOLD_BELOW_PX,
  });
  const { setFolded, canDock } = fold;
  const keepTreeFocus = useKeepTreeFocus({ host, shownAgentId });
  const onSelect = useCallback(
    (agentId: AgentId) => {
      if (!canDock) {
        setFolded(true);
      }
      if (agentId === shownAgentId) {
        return;
      }
      keepTreeFocus();
      navigate({ to: agentPlace({ sessionId, agentId }) });
    },
    [canDock, setFolded, shownAgentId, keepTreeFocus, navigate, sessionId],
  );
  if (host === null) {
    return null;
  }
  return createPortal(
    <div
      data-run-agents-rail=""
      className="flex h-full min-h-0 border-r border-border-soft motion-safe:animate-fade-in"
    >
      <StudioRailLayout
        railLabel={NAMES.agents}
        railWidth="wide"
        max={RAIL_MAX_PX}
        surface={RUN_AGENTS_RAIL_SURFACE}
        placement="page"
        isCollapsed={fold.isCollapsed}
        onCollapsedChange={setFolded}
        hasPageOutside
        railHeader={<RunAgentsRailHead count={leadAgentCountOf({ items })} />}
        rail={
          <ScrollFade className="min-h-0 flex-1" viewportClassName="flex flex-col px-2 pb-3">
            <LeadTree
              items={items}
              root={root}
              selectedAgentId={shownAgentId}
              onSelect={onSelect}
              onEditNote={onEditNote}
              onRemoveNote={onRemoveNote}
            />
          </ScrollFade>
        }
        detail={null}
      />
    </div>,
    host,
  );
};
