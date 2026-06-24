import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { AgentId, Session, SessionId } from '@goodboy/types';
import { Divider, ScrollFade, cn } from '@goodboy/ui';
import { ChatView } from '../../../chat/components/ChatView';
import { TerminalDock } from '../../../terminal/components/TerminalDock';
import { PlanStudio } from '../../../plans/components/PlanStudio';
import { ScriptsPanel } from '../../../scripts';
import { readPersistedLens, useAppStore, useFilesTouched } from '../../../../store';
import type { LensKind } from '../../../../store';
import { worktreeStatus } from '../../../worktree/worktree';
import { AgentsSection } from '../../../workspace/components/WorkspacesSidebar/parts/AgentsSection';
import { SessionOverviewPane } from '../SessionOverviewPane';
import { SessionStudioLayer } from './parts/SessionStudioLayer';
import { SessionTopBar } from './parts/SessionTopBar';
import { LensColumn } from './parts/LensColumn';
import { QuestionsPane } from './parts/QuestionsPane';
import { SlotPane } from './parts/SlotPane';
import { PrPane } from './parts/PrPane';
import { FilesPane } from './parts/FilesPane';
import { PaneShell } from './parts/PaneShell';
import { useSelectedAgentHome } from './hooks/useSelectedAgentHome';

const LENS_LABEL: Record<LensKind, string> = {
  questions: 'Questions',
  agents: 'Agents',
  workflows: 'Workflows',
  resolve: 'Resolve',
  plans: 'Plans',
  scripts: 'Scripts',
  terminal: 'Terminal',
  goal: 'Goal',
  decisions: 'Decisions',
  last_output_summary: 'Last output',
  pr: 'Pull request',
  files: 'Diff',
};

type SessionWorkspaceProps = {
  readonly session: Session;
  readonly isActive: boolean;
};

export const SessionWorkspace = ({ session, isActive }: SessionWorkspaceProps) => {
  const sessionId = session.id as SessionId;
  const activeLens = useAppStore((s) => s.activeLens[sessionId]);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const focusedPlanId = useAppStore((s) => s.focusedPlanId[sessionId] ?? null);
  const selectedAgentId = useAppStore(
    (s) => s.selectedAgentId[sessionId] ?? null,
  ) as AgentId | null;
  const agentHome = useSelectedAgentHome(sessionId);
  const workingDir = useAppStore((s) => (s.sessionWorktrees[sessionId] ?? [])[0] ?? null);
  const studio = useAppStore((s) => s.sessionStudio[sessionId] ?? null);
  const setSessionStudio = useAppStore((s) => s.setSessionStudio);
  const reconcileSessionBranch = useAppStore((s) => s.reconcileSessionBranch);
  const filesTouched = useFilesTouched(sessionId, isActive);

  useEffect(() => {
    if (activeLens === undefined) {
      setActiveLens(sessionId, readPersistedLens(sessionId));
    }
  }, [activeLens, sessionId, setActiveLens]);

  useEffect(() => {
    if (!isActive || !workingDir) return;
    let cancelled = false;
    worktreeStatus(workingDir)
      .then((status) => {
        if (!cancelled && status.branch) {
          void reconcileSessionBranch(sessionId, status.branch);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isActive, workingDir, sessionId, filesTouched.count, reconcileSessionBranch]);

  const lens: LensKind | null = activeLens ?? null;
  const onSelectLens = (next: LensKind) => {
    setActiveLens(sessionId, next);
  };
  const onSelectOverview = () => {
    setActiveLens(sessionId, null);
  };
  const showStudio = studio != null;
  const showAgentOverlay = selectedAgentId != null && !showStudio;
  const showLens = selectedAgentId == null && !showStudio;
  const onBareOverview = showLens && lens === null;
  const overlayHome = agentHome ?? 'agents';

  useEffect(() => {
    if (!showAgentOverlay) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      setActiveLens(sessionId, overlayHome);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAgentOverlay, sessionId, overlayHome, setActiveLens]);

  return (
    <div className="flex h-full w-full flex-col">
      <SessionTopBar session={session} />
      <div className="flex min-h-0 flex-1">
        {onBareOverview ? null : (
          <>
            <div className="flex w-60 shrink-0 flex-col bg-background">
              <LensColumn
                session={session}
                activeLens={lens}
                onSelect={onSelectLens}
                onSelectOverview={onSelectOverview}
                filesCount={filesTouched.count}
              />
            </div>
            <Divider orientation="vertical" />
          </>
        )}
        <div className="relative min-w-0 flex-1">
          {showLens ? (
            <div className="absolute inset-0 z-0">
              {lens === null ? (
                <SessionOverviewPane
                  session={session}
                  filesTouched={filesTouched}
                  onSelectLens={onSelectLens}
                />
              ) : null}
              {lens === 'questions' ? <QuestionsPane session={session} /> : null}
              {lens === 'plans' ? (
                <PlanStudio sessionId={sessionId} initialPlanId={focusedPlanId ?? undefined} />
              ) : null}
              {lens === 'workflows' ? (
                <PaneShell
                  title="Workflows"
                  description="Sequences of agents that drive this session toward its goal."
                  width="3xl"
                >
                  <AgentsSection task={session} only="workflows" />
                </PaneShell>
              ) : null}
              {lens === 'resolve' ? (
                <PaneShell
                  title="Resolve"
                  description="Resolver agents spawned from pull request comments and diff selections."
                  width="3xl"
                >
                  <AgentsSection task={session} only="resolve" />
                </PaneShell>
              ) : null}
              {lens === 'scripts' ? (
                <PaneShell title="Scripts" width="3xl">
                  <ScriptsPanel
                    workspaceId={session.workspaceId}
                    sessionId={sessionId}
                    worktreePath={workingDir}
                  />
                </PaneShell>
              ) : null}
              {lens === 'goal' || lens === 'decisions' || lens === 'last_output_summary' ? (
                <SlotPane session={session} slotKey={lens} />
              ) : null}
              {lens === 'pr' ? <PrPane session={session} /> : null}
              {lens === 'files' ? (
                <FilesPane
                  sessionId={sessionId}
                  workingDir={workingDir}
                  onClose={onSelectOverview}
                />
              ) : null}
              <Pane visible={lens === 'agents'}>
                <PaneShell
                  title="Agents"
                  description="Agents you spawn by hand to work this session."
                  width="3xl"
                >
                  <AgentsSection task={session} only="agents" />
                </PaneShell>
              </Pane>
            </div>
          ) : null}

          {showAgentOverlay ? (
            <div className="absolute inset-0 z-20 flex bg-background motion-safe:animate-studio-in">
              <div className="flex w-72 shrink-0 flex-col bg-background">
                <button
                  type="button"
                  onClick={() => setActiveLens(sessionId, overlayHome)}
                  className="flex shrink-0 items-center gap-1.5 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.03] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  <ArrowLeft size={14} aria-hidden className="shrink-0" />
                  <span className="truncate">{LENS_LABEL[overlayHome]}</span>
                </button>
                <Divider />
                <ScrollFade className="min-h-0 flex-1">
                  <div className="px-2 py-2">
                    <AgentsSection task={session} only={overlayHome} />
                  </div>
                </ScrollFade>
              </div>
              <Divider orientation="vertical" />
              <div className="min-h-0 min-w-0 flex-1">
                <ChatView session={session} isActive={isActive && selectedAgentId != null} />
              </div>
            </div>
          ) : null}

          <div
            className={cn(
              'absolute inset-0 z-10 flex flex-col',
              !(lens === 'terminal' && showLens) && 'invisible pointer-events-none',
            )}
          >
            <TerminalDock
              sessionId={sessionId}
              isActive={isActive && lens === 'terminal' && showLens}
              cwd={workingDir}
            />
          </div>

          {studio != null ? (
            <div className="absolute inset-0 z-30">
              <SessionStudioLayer
                session={session}
                studio={studio}
                onClose={() => setSessionStudio(sessionId, null)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

type PaneProps = {
  readonly visible: boolean;
  readonly children: React.ReactNode;
};

const Pane = ({ visible, children }: PaneProps) => (
  <div hidden={!visible} className={cn('absolute inset-0', !visible && 'pointer-events-none')}>
    {children}
  </div>
);
