import { ResizeHandle } from '@goodboy/ui';
import type { AgentId, Session, SessionId } from '@goodboy/types';
import { ChatView } from '../../../../chat/components/ChatView';
import type { AgentHomeLens } from '../../../agent-kind';
import { AgentInspector } from '../../AgentInspector';
import { agentOverlayHeader } from './agentOverlayHeader';
import { useColumnWidth } from '../../../../../shared/hooks/useColumnWidth';
import { STORAGE_KEYS } from '../../../../../shared/lib/storage-keys';
import { WorkflowStepInspector } from '../../../../workflows/components/WorkflowStepInspector';

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
            <AgentInspector sessionId={sessionId} agentId={inspectedResolverId} />
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
      {overlayHome === 'workflows' && selectedAgentId !== null ? (
        <>
          <ResizeHandle
            value={inspectorWidth}
            min={260}
            max={560}
            onChange={setInspectorWidth}
            onReset={() => setInspectorWidth(320)}
            side="right"
            ariaLabel="resize workflow step inspector"
          />
          <div className="flex shrink-0 flex-col bg-background" style={{ width: inspectorWidth }}>
            <WorkflowStepInspector session={session} agentId={selectedAgentId} />
          </div>
        </>
      ) : null}
    </div>
  );
};
