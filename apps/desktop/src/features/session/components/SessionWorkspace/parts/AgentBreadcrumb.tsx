import { useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Popover, ScrollFade, cn } from '@goodboy/ui';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { AgentAvatar } from '../../../../../shared/components/AgentAvatar';
import { useDropdown } from '../../../../../shared/hooks/useDropdown';
import { agentHomeLens, classifyAgent, type AgentHomeLens } from '../../../agent-kind';
import { isAgentFinished } from '../../../agent-lifecycle';
import { useResolverIndex } from '../../../hooks/useResolverIndex';
import type { ResolverStatus } from '../../../resolver-linkage';
import { agentOverlayCrumbs } from './agentOverlayCrumbs';

const CRUMB_CLASS =
  'min-w-0 truncate rounded-sm text-2xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

const SIBLING_GROUP_LABEL_CLASS =
  'px-2 pb-1 pt-2 text-3xs font-medium uppercase tracking-[0.12em] text-muted-foreground/60 first:pt-1';

type Props = {
  readonly sessionId: SessionId;
  readonly selectedAgentId: AgentId | null;
  readonly overlayHome: AgentHomeLens;
  readonly homeLabel: string;
  readonly onHome: () => void;
};

export const AgentBreadcrumb = ({
  sessionId,
  selectedAgentId,
  overlayHome,
  homeLabel,
  onHome,
}: Props) => {
  const { open, close, toggle, containerRef, popupClassName } = useDropdown({
    align: 'start',
    expectedHeight: 260,
    width: 'w-64 max-w-[calc(100vw-2rem)]',
  });
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
  const siblings = useMemo(
    () =>
      phaseRuns
        .filter(
          (agent) =>
            agent.parentAgentId == null &&
            agentHomeLens(agent, classifyAgent(agent, agentKindOverride[agent.id] ?? null)) ===
              overlayHome,
        )
        .sort((a, b) => b.ordinal - a.ordinal),
    [phaseRuns, agentKindOverride, overlayHome],
  );
  const siblingFinished = (agent: Agent): boolean =>
    isAgentFinished({ agent, resolverStatus: resolverStatusByAgentId.get(agent.id) ?? null });
  const activeSiblings = useMemo(
    () => siblings.filter((agent) => !siblingFinished(agent)),
    [siblings, resolverStatusByAgentId],
  );
  const doneSiblings = useMemo(
    () => siblings.filter((agent) => siblingFinished(agent)),
    [siblings, resolverStatusByAgentId],
  );
  const showSiblingGroupLabels = activeSiblings.length > 0 && doneSiblings.length > 0;
  const selectedAgent = phaseRuns.find((agent) => agent.id === selectedAgentId) ?? null;
  const crumbs = agentOverlayCrumbs({
    homeLabel,
    agentName: selectedAgent?.name ?? null,
    onHome,
  });
  const homeCrumb = crumbs[0]!;
  const agentCrumb = crumbs[1] ?? null;
  const canSwitch = siblings.length > 1;

  const renderSiblingRow = (agent: Agent) => (
    <button
      key={agent.id}
      type="button"
      role="menuitem"
      onClick={() => {
        close();
        void selectAgent(sessionId, agent.id);
      }}
      className={cn(
        'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
        agent.id === selectedAgentId
          ? 'bg-background text-foreground'
          : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
      )}
    >
      <AgentAvatar kind={classifyAgent(agent, agentKindOverride[agent.id] ?? null)} size="sm" />
      <span className="min-w-0 flex-1 truncate">{agent.name}</span>
      <span className="shrink-0 text-2xs uppercase tracking-wide text-muted-foreground/70">
        {agent.status}
      </span>
    </button>
  );

  return (
    <nav aria-label="Agent breadcrumb" className="flex min-w-0 items-center gap-1">
      <button
        type="button"
        onClick={homeCrumb.onClick}
        title={homeCrumb.label}
        className={cn(CRUMB_CLASS, 'max-w-40 shrink-0')}
      >
        {homeCrumb.label}
      </button>
      {agentCrumb != null && (
        <>
          <ChevronRight size={11} aria-hidden className="shrink-0 text-muted-foreground/40" />
          <div ref={containerRef} className="relative flex min-w-0 items-center">
            {!canSwitch && (
              <span
                aria-current="page"
                title={agentCrumb.label}
                className="min-w-0 max-w-56 truncate text-2xs font-semibold text-foreground/90"
              >
                {agentCrumb.label}
              </span>
            )}
            {canSwitch && (
              <button
                type="button"
                onClick={toggle}
                title={`${agentCrumb.label}. Switch agent.`}
                aria-haspopup="menu"
                aria-expanded={open}
                className="flex min-w-0 items-center gap-1 rounded-sm text-2xs font-semibold text-foreground/90 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <span className="min-w-0 max-w-56 truncate">{agentCrumb.label}</span>
                <ChevronDown
                  size={11}
                  aria-hidden
                  className={cn('shrink-0 text-muted-foreground/60', open && 'rotate-180')}
                />
              </button>
            )}
            {open && (
              <Popover
                role="menu"
                ariaLabel="Switch agent"
                className={cn(popupClassName, 'flex flex-col bg-subtle')}
              >
                <ScrollFade fadeFrom="subtle" className="min-h-0 max-h-64">
                  <div className="flex flex-col gap-0.5 p-1">
                    {activeSiblings.length > 0 && (
                      <>
                        {showSiblingGroupLabels && (
                          <span className={SIBLING_GROUP_LABEL_CLASS}>Active</span>
                        )}
                        {activeSiblings.map(renderSiblingRow)}
                      </>
                    )}
                    {doneSiblings.length > 0 && (
                      <>
                        {showSiblingGroupLabels && (
                          <span className={SIBLING_GROUP_LABEL_CLASS}>Done</span>
                        )}
                        {doneSiblings.map(renderSiblingRow)}
                      </>
                    )}
                  </div>
                </ScrollFade>
              </Popover>
            )}
          </div>
        </>
      )}
    </nav>
  );
};
