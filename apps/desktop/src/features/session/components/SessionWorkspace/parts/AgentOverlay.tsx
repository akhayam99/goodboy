import { ResizeHandle } from '@goodboy/ui';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import { ChatView } from '../../../../chat/components/ChatView';
import { classifyAgent, type AgentHomeLens } from '../../../agent-kind';
import { AgentInspector } from '../../AgentInspector';
import { ResolverDetailPane } from '../../ResolverDetailPane';
import { agentOverlayHeader } from './agentOverlayHeader';
import { useColumnWidth } from '../../../../../shared/hooks/useColumnWidth';
import { STORAGE_KEYS } from '../../../../../shared/lib/storage-keys';
import { WorkflowStepInspector } from '../../../../workflows/components/WorkflowStepInspector';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { isWorkflowStepAgent } from '../../../../workflows/isWorkflowStepAgent';

type Props = {
  readonly session: Session;
  readonly sessionId: SessionId;
  readonly isChatActive: boolean;
  readonly selectedAgentId: AgentId | null;
  readonly overlayHome: AgentHomeLens;
  readonly overlayHomeLabel: string;
  readonly showWorkflowStrip: boolean;
  readonly onOverview: () => void;
  readonly onBack: () => void;
  readonly onOpenWorkflow: () => void;
};

export const AgentOverlay = ({
  session,
  sessionId,
  isChatActive,
  selectedAgentId,
  overlayHome,
  overlayHomeLabel,
  showWorkflowStrip,
  onOverview,
  onBack,
  onOpenWorkflow,
}: Props) => {
  const [inspectorWidth, setInspectorWidth] = useColumnWidth(STORAGE_KEYS.inspectorPanelWidth, 320);
  const selectedAgent = useAppStore(
    (state) =>
      (state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>)).find(
        (agent) => agent.id === selectedAgentId,
      ) ?? null,
  );
  const kindOverride = useAppStore((state) =>
    selectedAgentId === null ? null : (state.agentKindOverride[selectedAgentId] ?? null),
  );
  const isResolver =
    selectedAgent !== null && classifyAgent(selectedAgent, kindOverride) === 'resolver';
  const showWorkflowStepInspector =
    overlayHome === 'workflows' &&
    selectedAgent !== null &&
    isWorkflowStepAgent({ agent: selectedAgent });
  const header = agentOverlayHeader({
    session,
    sessionId,
    selectedAgentId,
    overlayHome,
    overlayHomeLabel,
    showWorkflowStrip,
    onOverview,
    onBack,
    onOpenWorkflow,
  });

  if (isResolver && selectedAgent !== null) {
    return (
      <div className="absolute inset-0 z-20 flex flex-col bg-background motion-safe:animate-studio-in">
        {header}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ResolverDetailPane
            session={session}
            agent={selectedAgent}
            isChatActive={isChatActive}
            onBack={onBack}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-20 flex bg-background motion-safe:animate-studio-in">
      <div className="min-h-0 min-w-0 flex-1">
        <ChatView session={session} isActive={isChatActive} header={header} />
      </div>
      {overlayHome === 'agents' && selectedAgentId !== null ? (
        <>
          <ResizeHandle
            value={inspectorWidth}
            min={260}
            max={560}
            onChange={setInspectorWidth}
            onReset={() => setInspectorWidth(320)}
            side="right"
            ariaLabel="Resize agent inspector"
          />
          <div className="flex shrink-0 flex-col bg-background" style={{ width: inspectorWidth }}>
            <AgentInspector sessionId={sessionId} agentId={selectedAgentId} />
          </div>
        </>
      ) : null}
      {showWorkflowStepInspector && selectedAgentId !== null ? (
        <>
          <ResizeHandle
            value={inspectorWidth}
            min={260}
            max={560}
            onChange={setInspectorWidth}
            onReset={() => setInspectorWidth(320)}
            side="right"
            ariaLabel="Resize workflow step inspector"
          />
          <div className="flex shrink-0 flex-col bg-background" style={{ width: inspectorWidth }}>
            <WorkflowStepInspector session={session} agentId={selectedAgentId} />
          </div>
        </>
      ) : null}
    </div>
  );
};
