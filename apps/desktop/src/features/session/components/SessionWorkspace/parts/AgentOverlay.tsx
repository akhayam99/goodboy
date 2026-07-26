import { ArrowLeft } from 'lucide-react';
import { Divider, ResizeHandle, ScrollFade } from '@goodboy/ui';
import type { AgentId, Session, SessionId } from '@goodboy/types';
import { ChatView } from '../../../../chat/components/ChatView';
import { AgentsSection } from '../../../../workspace/components/WorkspacesSidebar/parts/AgentsSection';
import type { AgentHomeLens } from '../../../agent-kind';
import { AgentInspector } from '../../AgentInspector';
import { ResolverInspector } from '../../ResolverInspector';
import { agentOverlayHeader } from './agentOverlayHeader';
import { useColumnWidth } from '../../../../../shared/hooks/useColumnWidth';
import { STORAGE_KEYS } from '../../../../../shared/lib/storage-keys';

type Props = {
  readonly session: Session;
  readonly sessionId: SessionId;
  readonly isChatActive: boolean;
  readonly selectedAgentId: AgentId | null;
  readonly inspectedResolverId: AgentId | null;
  readonly overlayHome: AgentHomeLens;
  readonly overlayHomeLabel: string;
  readonly showWorkflowStrip: boolean;
  readonly onBack: () => void;
  readonly onOpenWorkflow: () => void;
};

export const AgentOverlay = ({
  session,
  sessionId,
  isChatActive,
  selectedAgentId,
  inspectedResolverId,
  overlayHome,
  overlayHomeLabel,
  showWorkflowStrip,
  onBack,
  onOpenWorkflow,
}: Props) => {
  const [listWidth, setListWidth] = useColumnWidth(STORAGE_KEYS.agentOverlayListWidth, 288);
  const [inspectorWidth, setInspectorWidth] = useColumnWidth(STORAGE_KEYS.inspectorPanelWidth, 320);
  const header = agentOverlayHeader({
    session,
    sessionId,
    selectedAgentId,
    overlayHome,
    overlayHomeLabel,
    showWorkflowStrip,
    onBack,
    onOpenWorkflow,
  });

  return (
    <div className="absolute inset-0 z-20 flex bg-background motion-safe:animate-studio-in">
      {overlayHome === 'workflows' ? null : (
        <>
          <div className="flex shrink-0 flex-col bg-background" style={{ width: listWidth }}>
            <button
              type="button"
              onClick={onBack}
              className="flex shrink-0 items-center gap-1.5 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.03] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <ArrowLeft size={14} aria-hidden className="shrink-0" />
              <span className="truncate">{overlayHomeLabel}</span>
            </button>
            <Divider />
            <ScrollFade className="min-h-0 flex-1">
              <div className="px-2 py-2">
                <AgentsSection task={session} only={overlayHome} />
              </div>
            </ScrollFade>
          </div>
          <ResizeHandle
            value={listWidth}
            min={220}
            max={480}
            onChange={setListWidth}
            onReset={() => setListWidth(288)}
            ariaLabel="resize agent list"
          />
        </>
      )}
      <div className="min-h-0 min-w-0 flex-1">
        <ChatView session={session} isActive={isChatActive} header={header} />
      </div>
      {overlayHome === 'resolve' && inspectedResolverId !== null ? (
        <>
          <ResizeHandle
            value={inspectorWidth}
            min={260}
            max={560}
            onChange={setInspectorWidth}
            onReset={() => setInspectorWidth(320)}
            side="right"
            ariaLabel="resize resolver inspector"
          />
          <div className="flex shrink-0 flex-col bg-background" style={{ width: inspectorWidth }}>
            <ResolverInspector sessionId={sessionId} agentId={inspectedResolverId} />
          </div>
        </>
      ) : null}
      {overlayHome === 'agents' && selectedAgentId !== null ? (
        <>
          <ResizeHandle
            value={inspectorWidth}
            min={260}
            max={560}
            onChange={setInspectorWidth}
            onReset={() => setInspectorWidth(320)}
            side="right"
            ariaLabel="resize agent inspector"
          />
          <div className="flex shrink-0 flex-col bg-background" style={{ width: inspectorWidth }}>
            <AgentInspector sessionId={sessionId} agentId={selectedAgentId} />
          </div>
        </>
      ) : null}
    </div>
  );
};
