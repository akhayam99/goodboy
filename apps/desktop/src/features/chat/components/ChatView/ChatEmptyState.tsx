import { useCallback, useMemo, type ReactElement, type ReactNode } from 'react';
import { Button, Eyebrow, KbdPill, cn } from '@goodboy/ui';
import { PANE_RHYTHM } from '../../../../shared/components/paneRhythm';
import type { AgentId, SessionId } from '@goodboy/types';
import { DogMascot } from '../../../../shared/components/DogMascot';
import { SECTION_ICONS } from '../../../../shared/components/section-icons';
import {
  AGENT_KIND_META,
  inferAgentKindFromName,
  type AgentKind as AgentKindLabel,
} from '../../../session/agent-kind';
import { useAppStore } from '../../../../store';
import { getAgentVisual } from '../../../../shared/components/AgentAvatar';
import { formatCombo } from '../../../../shared/keyboard/registry';

const HINT_KBD = 'h-4 min-w-4 border-border-soft px-1 text-2xs leading-none';

type EmptyScenario = 'fresh' | 'workflow_no_agent' | 'pick_agent' | 'agent_focus';

type EmptyCopy = {
  eyebrow: string;
  title: string;
  body: string;
  hints: ReadonlyArray<ReactNode>;
};

type Props = {
  readonly sessionId: SessionId;
  readonly selectedAgentId: AgentId | null;
  readonly phaseRuns: ReadonlyArray<import('@goodboy/types').Agent>;
  readonly hasWorkflow: boolean;
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
    return agentKindOverride[selectedAgent.id] ?? inferAgentKindFromName(selectedAgent.name);
  }, [selectedAgent, agentKindOverride]);

  const scenario = useMemo<EmptyScenario>(() => {
    if (selectedAgent && selectedKind) {
      return 'agent_focus';
    }
    if (phaseRuns.length > 0) {
      return 'pick_agent';
    }
    if (hasWorkflow) {
      return 'workflow_no_agent';
    }
    return 'fresh';
  }, [selectedAgent, selectedKind, phaseRuns.length, hasWorkflow]);

  const copy = useMemo<EmptyCopy>(() => {
    switch (scenario) {
      case 'agent_focus': {
        const meta = AGENT_KIND_META[selectedKind as AgentKindLabel];
        const example =
          selectedKind === 'scout'
            ? 'find where X is defined'
            : selectedKind === 'planner'
              ? 'plan how to add X to Y'
              : selectedKind === 'implementer'
                ? 'implement step 2 of the plan'
                : selectedKind === 'debugger'
                  ? 'reproduce: <stack trace>'
                  : selectedKind === 'tester'
                    ? 'write tests for X'
                    : selectedKind === 'reviewer'
                      ? 'review the current diff'
                      : selectedKind === 'resolver'
                        ? 'spawned by the resolve flow'
                        : null;
        return {
          eyebrow: `${meta.label.toLowerCase()} agent`,
          title: `${meta.label} agent ready`,
          body: 'Shares the session brief. Say what to do next.',
          hints: [
            example ? <span key="example">{example}</span> : null,
            <span key="send" className="inline-flex items-center gap-1">
              <KbdPill className={HINT_KBD}>{formatCombo('Enter')}</KbdPill>
              to send
            </span>,
          ].filter((x): x is ReactElement => x !== null),
        };
      }
      case 'pick_agent':
        return {
          eyebrow: `${phaseRuns.length === 1 ? 'agent' : 'agents'} in session`,
          title: 'Pick an agent',
          body: 'Agents share the session context. Pick one or spawn another.',
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
      default:
        return {
          eyebrow: 'fresh session',
          title: 'Populate the context',
          body: 'What you type becomes the shared brief every spawned agent starts from.',
          hints: [
            <span key="what">what to build</span>,
            <span key="limits">constraints and non-goals</span>,
            <span key="first">the first agent</span>,
          ],
        };
    }
  }, [scenario, selectedKind, phaseRuns.length]);

  const agentVisual =
    scenario === 'agent_focus' && selectedKind ? getAgentVisual(selectedKind) : null;

  const showWorkflowCta = scenario === 'fresh' || scenario === 'workflow_no_agent';
  const openWorkflowBuilder = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
    );
  }, [sessionId]);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-5 px-6 py-16 text-center',
        PANE_RHYTHM.column,
        PANE_RHYTHM.measure.hero,
      )}
    >
      <div className="flex items-center justify-center">
        {agentVisual?.image ? (
          <span
            aria-hidden
            className="size-32 shrink-0"
            style={{
              backgroundColor: agentVisual.color,
              maskImage: `url(${agentVisual.image})`,
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
              maskSize: 'contain',
              WebkitMaskImage: `url(${agentVisual.image})`,
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              WebkitMaskSize: 'contain',
            }}
          />
        ) : scenario === 'pick_agent' ? (
          <span className="text-7xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {phaseRuns.length}
          </span>
        ) : (
          <DogMascot size={128} className="text-primary" />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Eyebrow label={copy.eyebrow} className="tracking-[0.12em] text-muted-foreground/70" />
        <h2 className="text-base font-semibold text-foreground">{copy.title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
      </div>
      <ul className="flex flex-wrap items-center justify-center gap-1.5 text-2xs text-muted-foreground/70">
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
          <SECTION_ICONS.workflows size={13} aria-hidden />
          Set up a workflow
        </Button>
      ) : null}
    </div>
  );
};
