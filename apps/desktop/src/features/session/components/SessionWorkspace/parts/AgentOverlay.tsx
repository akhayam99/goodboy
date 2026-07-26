import { ArrowLeft } from 'lucide-react';
import { Divider, ScrollFade } from '@goodboy/ui';
import type { AgentId, Session, SessionId } from '@goodboy/types';
import { ChatView } from '../../../../chat/components/ChatView';
import { AgentsSection } from '../../../../workspace/components/WorkspacesSidebar/parts/AgentsSection';
import type { AgentHomeLens } from '../../../agent-kind';
import { AgentInspector } from '../../AgentInspector';
import { ResolverInspector } from '../../ResolverInspector';
import { agentOverlayHeader } from './agentOverlayHeader';

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
          <div className="flex w-72 shrink-0 flex-col bg-background">
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
          <Divider orientation="vertical" />
        </>
      )}
      <div className="min-h-0 min-w-0 flex-1">
        <ChatView session={session} isActive={isChatActive} header={header} />
      </div>
      {overlayHome === 'resolve' && inspectedResolverId !== null ? (
        <>
          <Divider orientation="vertical" />
          <div className="flex w-80 shrink-0 flex-col bg-background">
            <ResolverInspector sessionId={sessionId} agentId={inspectedResolverId} />
          </div>
        </>
      ) : null}
      {overlayHome === 'agents' && selectedAgentId !== null ? (
        <>
          <Divider orientation="vertical" />
          <div className="flex w-80 shrink-0 flex-col bg-background">
            <AgentInspector sessionId={sessionId} agentId={selectedAgentId} />
          </div>
        </>
      ) : null}
    </div>
  );
};
