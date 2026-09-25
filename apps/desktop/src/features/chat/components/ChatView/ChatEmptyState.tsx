import { useCallback, useMemo, type ReactNode } from 'react';
import { Button, Eyebrow, cn } from '@goodboy/ui';
import { PANE_RHYTHM } from '@goodboy/ui';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { DogMascot } from '../../../../shared/components/DogMascot';
import { SECTION_ICONS } from '../../../../shared/components/section-icons';
import { classifyAgent } from '../../../session/agent-kind';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { AgentFocusEmpty } from './AgentFocusEmpty';

type NoAgentScenario = 'fresh' | 'workflow_no_agent' | 'pick_agent';

type EmptyCopy = {
  eyebrow: string;
  title: string;
  body: string;
  hints: ReadonlyArray<ReactNode>;
};

type Props = {
  readonly sessionId: SessionId;
  readonly selectedAgentId: AgentId | null;
  readonly phaseRuns: ReadonlyArray<Agent>;
  readonly hasWorkflow: boolean;
};

type CopyParams = {
  readonly scenario: NoAgentScenario;
  readonly agentCount: number;
};

const copyFor = ({ scenario, agentCount }: CopyParams): EmptyCopy => {
  switch (scenario) {
    case 'pick_agent':
      return {
        eyebrow: `${agentCount === 1 ? 'agent' : 'agents'} in session`,
        title: 'Pick an agent',
        body: 'Agents share the session context. Pick one or start another.',
        hints: [
          <span key="select">select to open its transcript</span>,
          <span key="spawn">context travels to new agents</span>,
        ],
      };
    case 'workflow_no_agent':
      return {
        eyebrow: 'workflow ready',
        title: 'Start the first step',
        body: 'Type the goal below to shape the shared brief before the first agent runs.',
        hints: [
          <span key="goal">goal in 1-2 lines</span>,
          <span key="brief">lands in the shared brief</span>,
        ],
      };
    case 'fresh':
      return {
        eyebrow: 'fresh session',
        title: 'Populate the context',
        body: 'What you type becomes the shared brief every new agent starts from.',
        hints: [
          <span key="what">what to build</span>,
          <span key="limits">constraints and non-goals</span>,
          <span key="first">the first agent</span>,
        ],
      };
    default: {
      const exhaustive: never = scenario;
      throw new Error(`unknown empty scenario: ${String(exhaustive)}`);
    }
  }
};

export const ChatEmptyState = ({ sessionId, selectedAgentId, phaseRuns, hasWorkflow }: Props) => {
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const selectedAgent = useMemo(
    () => (selectedAgentId ? (phaseRuns.find((r) => r.id === selectedAgentId) ?? null) : null),
    [selectedAgentId, phaseRuns],
  );
  const selectedKind = useMemo(() => {
    if (!selectedAgent) {
      return null;
    }
    return classifyAgent({
      agent: selectedAgent,
      override: agentKindOverride[selectedAgent.id] ?? null,
    });
  }, [selectedAgent, agentKindOverride]);
  const openWorkflowBuilder = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
    );
  }, [sessionId]);

  if (selectedAgent && selectedKind) {
    return <AgentFocusEmpty kind={selectedKind} />;
  }

  const scenario: NoAgentScenario =
    phaseRuns.length > 0 ? 'pick_agent' : hasWorkflow ? 'workflow_no_agent' : 'fresh';
  const copy = copyFor({ scenario, agentCount: phaseRuns.length });
  const showWorkflowCta = scenario === 'fresh' || scenario === 'workflow_no_agent';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-5 px-6 py-16 text-center',
        PANE_RHYTHM.column,
        PANE_RHYTHM.hero,
      )}
    >
      <div className="flex items-center justify-center">
        {scenario === 'pick_agent' ? (
          <span className="text-7xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {phaseRuns.length}
          </span>
        ) : (
          <DogMascot size={128} className="text-primary" />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Eyebrow label={copy.eyebrow} muted />
        <h2 className="text-base font-semibold text-foreground">{copy.title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
      </div>
      <ul className="flex flex-wrap items-center justify-center gap-1.5 text-2xs text-faint-foreground">
        {copy.hints.map((hint, i) => (
          <li
            key={i}
            className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-background px-2 py-0.5 text-2xs"
          >
            {hint}
          </li>
        ))}
      </ul>
      {showWorkflowCta ? (
        <Button variant="secondary" size="sm" onClick={openWorkflowBuilder}>
          <SECTION_ICONS.workflows size={ICON_SIZE.row} aria-hidden />
          Set up a workflow
        </Button>
      ) : null}
    </div>
  );
};
