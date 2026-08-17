import { useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Divider, Popover, ScrollFade, StatusDot, cn, useDropdown } from '@goodboy/ui';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useCurrentSession,
  useSessionStageInfo,
} from '../../../../store';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import type { BreadcrumbCrumb } from '../../../../app/components/AppBreadcrumb/buildBreadcrumb';
import { STAGE_TONE } from '../../session-stage';
import { useSessionCrumbs } from '../../hooks/useSessionCrumbs';
import { agentHomeLens, classifyAgent, type AgentHomeLens } from '../../agent-kind';
import { isAgentFinished } from '../../agent-lifecycle';
import { useResolverIndex } from '../../hooks/useResolverIndex';
import type { ResolverStatus } from '../../resolver-linkage';

const CRUMB_BUTTON_CLASS =
  'max-w-48 truncate rounded px-1 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

const CRUMB_LINK_CLASS = 'text-muted-foreground/70 hover:bg-muted/50 hover:text-foreground';

const CRUMB_LAST_CLASS = 'font-medium text-foreground';

const SIBLING_GROUP_LABEL_CLASS =
  'px-2 pb-1 pt-2 text-3xs font-medium uppercase tracking-[0.12em] text-muted-foreground/60 first:pt-1';

type SwitcherEntry = {
  readonly agent: Agent;
  readonly kind: ReturnType<typeof classifyAgent>;
  readonly isFinished: boolean;
};

type SessionCrumbsProps = {
  readonly session: Session;
};

const SessionCrumbs = ({ session }: SessionCrumbsProps) => {
  const sessionId = session.id as SessionId;
  const crumbs = useSessionCrumbs({ session });
  const stage = useSessionStageInfo(session);
  const selectedAgentId = useAppStore(
    (state) => state.selectedAgentId[sessionId] ?? null,
  ) as AgentId | null;
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const agentKindOverride = useAppStore((state) => state.agentKindOverride);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const resolverIndex = useResolverIndex(sessionId);
  const resolverStatusByAgentId = useMemo(() => {
    const map = new Map<AgentId, ResolverStatus>();
    for (const link of resolverIndex.links) {
      map.set(link.agent.id, link.status);
    }
    return map;
  }, [resolverIndex]);

  const selectedAgent = useMemo(
    () => phaseRuns.find((agent) => agent.id === selectedAgentId) ?? null,
    [phaseRuns, selectedAgentId],
  );

  const selectedAgentHome: AgentHomeLens | null = useMemo(() => {
    if (selectedAgent == null) {
      return null;
    }
    return agentHomeLens(
      selectedAgent,
      classifyAgent(selectedAgent, agentKindOverride[selectedAgent.id] ?? null),
    );
  }, [selectedAgent, agentKindOverride]);

  const siblings: ReadonlyArray<SwitcherEntry> = useMemo(() => {
    if (selectedAgent == null || selectedAgentHome == null) {
      return EMPTY_ARRAY as ReadonlyArray<SwitcherEntry>;
    }
    return phaseRuns
      .filter((agent) => agent.parentAgentId == null)
      .filter((agent) => {
        const kind = classifyAgent(agent, agentKindOverride[agent.id] ?? null);
        return agentHomeLens(agent, kind) === selectedAgentHome;
      })
      .map((agent) => {
        const kind = classifyAgent(agent, agentKindOverride[agent.id] ?? null);
        const isFinished = isAgentFinished({
          agent,
          resolverStatus: resolverStatusByAgentId.get(agent.id) ?? null,
        });
        return { agent, kind, isFinished };
      })
      .sort((a, b) => b.agent.ordinal - a.agent.ordinal);
  }, [phaseRuns, agentKindOverride, resolverStatusByAgentId, selectedAgent, selectedAgentHome]);

  const isSelectedCrumbAnAgent =
    selectedAgent != null &&
    crumbs.length > 0 &&
    crumbs[crumbs.length - 1]?.id === 'selected-child';
  const canSwitchAgent = isSelectedCrumbAnAgent && siblings.length > 1;

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="flex h-8 min-w-0 shrink-0 items-center gap-1.5 bg-background px-4"
      >
        <StatusDot tone={STAGE_TONE[stage.stage]} size="sm" title={stage.reason} />
        {crumbs.map((crumb, index) => (
          <span key={crumb.id} className="flex min-w-0 items-center gap-1.5">
            {index > 0 ? (
              <ChevronRight size={12} aria-hidden className="shrink-0 text-muted-foreground/40" />
            ) : null}
            {index === crumbs.length - 1 && canSwitchAgent && selectedAgent != null ? (
              <AgentSwitcherCrumb
                sessionId={sessionId}
                label={crumb.label}
                siblings={siblings}
                selectedAgentId={selectedAgent.id}
                onSelect={(id) => {
                  void selectAgent(sessionId, id);
                }}
              />
            ) : (
              <PlainCrumb crumb={crumb} isLast={index === crumbs.length - 1} />
            )}
          </span>
        ))}
      </nav>
      <Divider className="shrink-0" />
    </>
  );
};

type PlainCrumbProps = {
  readonly crumb: BreadcrumbCrumb;
  readonly isLast: boolean;
};

const PlainCrumb = ({ crumb, isLast }: PlainCrumbProps) =>
  crumb.onClick != null && !isLast ? (
    <button
      type="button"
      onClick={crumb.onClick}
      className={cn(CRUMB_BUTTON_CLASS, CRUMB_LINK_CLASS)}
    >
      {crumb.label}
    </button>
  ) : (
    <span
      aria-current={isLast ? 'page' : undefined}
      className={cn(CRUMB_BUTTON_CLASS, CRUMB_LAST_CLASS)}
    >
      {crumb.label}
    </span>
  );

type AgentSwitcherCrumbProps = {
  readonly sessionId: SessionId;
  readonly label: string;
  readonly siblings: ReadonlyArray<SwitcherEntry>;
  readonly selectedAgentId: AgentId;
  readonly onSelect: (id: AgentId) => void;
};

const AgentSwitcherCrumb = ({
  sessionId: _sessionId,
  label,
  siblings,
  selectedAgentId,
  onSelect,
}: AgentSwitcherCrumbProps) => {
  const { open, close, toggle, containerRef, popupClassName } = useDropdown({
    align: 'start',
    expectedHeight: 260,
    width: 'w-64 max-w-[calc(100vw-2rem)]',
  });
  const active = siblings.filter((entry) => !entry.isFinished);
  const done = siblings.filter((entry) => entry.isFinished);
  const showGroups = active.length > 0 && done.length > 0;

  return (
    <div ref={containerRef} className="relative flex min-w-0 items-center">
      <button
        type="button"
        onClick={toggle}
        title={`${label}. Switch agent.`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(CRUMB_BUTTON_CLASS, CRUMB_LAST_CLASS, 'inline-flex items-center gap-1')}
      >
        <span className="min-w-0 max-w-48 truncate">{label}</span>
        <ChevronDown
          size={11}
          aria-hidden
          className={cn('shrink-0 text-muted-foreground/60', open && 'rotate-180')}
        />
      </button>
      {open && (
        <Popover
          role="menu"
          ariaLabel="Switch agent"
          className={cn(popupClassName, 'flex flex-col bg-subtle')}
        >
          <ScrollFade fadeFrom="subtle" className="min-h-0 max-h-64">
            <div className="flex flex-col gap-0.5 p-1">
              {active.length > 0 && (
                <>
                  {showGroups && <span className={SIBLING_GROUP_LABEL_CLASS}>Active</span>}
                  {active.map((entry) => (
                    <SiblingRow
                      key={entry.agent.id}
                      entry={entry}
                      selectedAgentId={selectedAgentId}
                      onSelect={(id) => {
                        close();
                        onSelect(id);
                      }}
                    />
                  ))}
                </>
              )}
              {done.length > 0 && (
                <>
                  {showGroups && <span className={SIBLING_GROUP_LABEL_CLASS}>Done</span>}
                  {done.map((entry) => (
                    <SiblingRow
                      key={entry.agent.id}
                      entry={entry}
                      selectedAgentId={selectedAgentId}
                      onSelect={(id) => {
                        close();
                        onSelect(id);
                      }}
                    />
                  ))}
                </>
              )}
            </div>
          </ScrollFade>
        </Popover>
      )}
    </div>
  );
};

type SiblingRowProps = {
  readonly entry: SwitcherEntry;
  readonly selectedAgentId: AgentId;
  readonly onSelect: (id: AgentId) => void;
};

const SiblingRow = ({ entry, selectedAgentId, onSelect }: SiblingRowProps) => (
  <button
    key={entry.agent.id}
    type="button"
    role="menuitem"
    onClick={() => onSelect(entry.agent.id)}
    className={cn(
      'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
      entry.agent.id === selectedAgentId
        ? 'bg-background text-foreground'
        : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
    )}
  >
    <AgentAvatar kind={entry.kind} size="sm" />
    <span className="min-w-0 flex-1 truncate">{entry.agent.name}</span>
    <span className="shrink-0 text-2xs uppercase tracking-wide text-muted-foreground/70">
      {entry.agent.status}
    </span>
  </button>
);

export const SessionCrumbBar = () => {
  const currentSession = useCurrentSession();

  if (!currentSession) {
    return null;
  }
  return <SessionCrumbs key={currentSession.id} session={currentSession} />;
};
