import { useCallback, useMemo } from 'react';
import { Sparkles, Workflow } from 'lucide-react';
import { Button, cn } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { DogMascot } from '../../../../shared/components/DogMascot';
import agentDebugger from '../../../../assets/agents/debugger.png';
import agentDocs from '../../../../assets/agents/docs.png';
import agentGoodboy from '../../../../assets/agents/goodboy.png';
import agentImplementer from '../../../../assets/agents/implementer.png';
import agentPlanner from '../../../../assets/agents/planner.png';
import agentReviewer from '../../../../assets/agents/reviewer.png';
import agentScout from '../../../../assets/agents/scout.png';
import agentTester from '../../../../assets/agents/tester.png';
import {
  AGENT_KIND_META,
  inferAgentKindFromName,
  type AgentKind as AgentKindLabel,
} from '../../../session/agent-kind';
import { useAppStore } from '../../../../store';
import { MaskedDog } from './parts/MaskedDog';

type EmptyScenario = 'fresh' | 'workflow_no_agent' | 'pick_agent' | 'agent_focus';

type KindVisual = {
  image: string | null;
  tint: string;
};

const KIND_ICON: Record<AgentKindLabel, KindVisual> = {
  generic: {
    image: agentGoodboy,
    tint: 'bg-rose-400',
  },
  scout: {
    image: agentScout,
    tint: 'bg-sky-400',
  },
  planner: {
    image: agentPlanner,
    tint: 'bg-violet-400',
  },
  implementer: {
    image: agentImplementer,
    tint: 'bg-emerald-400',
  },
  debugger: {
    image: agentDebugger,
    tint: 'bg-amber-400',
  },
  tester: {
    image: agentTester,
    tint: 'bg-teal-400',
  },
  reviewer: {
    image: agentReviewer,
    tint: 'bg-cyan-400',
  },
  docs: {
    image: agentDocs,
    tint: 'bg-orange-400',
  },
  resolver: {
    image: null,
    tint: 'bg-lime-400',
  },
};

type EmptyCopy = {
  eyebrow: string;
  title: string;
  body: string;
  hints: ReadonlyArray<string>;
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
        return {
          eyebrow: `${meta.label} agent · fresh transcript`,
          title: `You're talking to a ${meta.label} agent`,
          body: 'It already knows the session brief on the right, so just say what you want next.',
          hints: [
            selectedKind === 'scout' ? 'Try: "find where X is defined"' : null,
            selectedKind === 'planner' ? 'Try: "plan how to add X to Y"' : null,
            selectedKind === 'implementer' ? 'Try: "implement step 2 of the plan"' : null,
            selectedKind === 'debugger' ? 'Try: "reproduce: <stack trace>"' : null,
            selectedKind === 'tester' ? 'Try: "write tests for X"' : null,
            selectedKind === 'reviewer' ? 'Try: "review the current diff"' : null,
            selectedKind === 'resolver' ? 'Spawned automatically by the resolve UI.' : null,
            '⌘↵ to send',
          ].filter((x): x is string => Boolean(x)),
        };
      }
      case 'pick_agent':
        return {
          eyebrow: `${phaseRuns.length === 1 ? 'agent' : 'agents'} in this session`,
          title: 'Pick an agent on the left',
          body: 'Agents share the session context, so pick one to keep talking or spawn a new one.',
          hints: ['Select an agent to see its transcript', 'Spawn fresh, context travels with it'],
        };
      case 'workflow_no_agent':
        return {
          eyebrow: 'Workflow ready · No agents yet',
          title: 'Start the first step',
          body: 'Type your goal below to shape the shared brief before the first agent runs.',
          hints: ['Describe the goal in 1-2 lines', 'Lands in the shared context'],
        };
      case 'fresh':
      default:
        return {
          eyebrow: 'Fresh session · No context yet',
          title: "Let's populate the context",
          body: 'What you type below becomes the shared brief every agent you spawn starts from.',
          hints: [
            'What are we building',
            'Any constraints or non-goals',
            'Who should the first agent be',
          ],
        };
    }
  }, [scenario, selectedKind, phaseRuns.length]);

  const agentVisual = scenario === 'agent_focus' && selectedKind ? KIND_ICON[selectedKind] : null;

  const showWorkflowCta = scenario === 'fresh' || scenario === 'workflow_no_agent';
  const openWorkflowBuilder = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
    );
  }, [sessionId]);

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <div className="flex items-center justify-center">
        {agentVisual?.image ? (
          <MaskedDog image={agentVisual.image} className={cn('size-32', agentVisual.tint)} />
        ) : scenario === 'pick_agent' ? (
          <span className="text-7xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {phaseRuns.length}
          </span>
        ) : (
          <DogMascot size={128} className="text-primary" />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
          {copy.eyebrow}
        </span>
        <h2 className="text-base font-semibold text-foreground">{copy.title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-2xs text-muted-foreground/70">
        {copy.hints.map((hint) => (
          <span
            key={hint}
            className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-background px-2 py-0.5 text-2xs"
          >
            <Sparkles size={10} aria-hidden />
            {hint}
          </span>
        ))}
      </div>
      {showWorkflowCta ? (
        <Button variant="secondary" size="sm" onClick={openWorkflowBuilder}>
          <Workflow size={13} aria-hidden />
          Set up a workflow
        </Button>
      ) : null}
    </div>
  );
};
