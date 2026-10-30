import type { Agent, AgentId, SessionEvent } from '@goodboy/types';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { ciFixRoleOf } from '../../../branch/checks/ciFixRole';
import { autoGroupOf } from '../../../auto/autoGroupOf';
import { joinNouns } from '../../../auto/joinNouns';
import { isWorkflowRunComplete } from '../../../workflows/isWorkflowRunComplete';
import { AGENT_KIND_META, type AgentKind } from '../../agent-kind';
import type {
  TimelineAgentEntry,
  TimelineEventEntry,
  TimelineRunEntry,
} from '../../timeline/buildTimelineGroups';
import type { DoneModel, DoneSource } from './doneTypes';
import { agentCountLabelOf } from '../../agentCountLabelOf';
import { descendantAgentsOf } from '../../descendantAgentsOf';
import { runAgentCountOf } from '../../runAgentCountOf';
import { autoNeedsYouCountOf } from './autoNeedsYouCountOf';
import { needsYouLabelOf } from './needsYouLabelOf';
import { plainTitleOf } from './plainTitleOf';
import { runNeedsYouCountOf } from './runNeedsYouCountOf';
import { runStepNumbersOf } from './runStepNumbersOf';
import { stepsLabelOf } from './stepsLabelOf';

export type OutcomeLine = {
  readonly title: string;
  readonly by: string;
  readonly kind: AgentKind | null;
  readonly leadAgentId: AgentId | null;
};

type Params = {
  readonly entry: DoneSource;
  readonly model: DoneModel;
  readonly slice?: ReadonlyArray<TimelineAgentEntry> | null;
};

const META_SEPARATOR = ' · ';

type MetaParams = {
  readonly parts: ReadonlyArray<string | null>;
};

const outcomeMetaOf = ({ parts }: MetaParams): string =>
  parts.filter((part) => part !== null && part !== '').join(META_SEPARATOR);

const UNKNOWN_BASE_TITLE = 'Rebased the branch';

const rebaseTitleOf = ({
  events,
  at,
}: {
  readonly events: ReadonlyArray<SessionEvent>;
  readonly at: string;
}): string => {
  const base = events
    .filter((event) => event.kind === 'rebase_requested' && event.createdAt <= at)
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
    .map((event) => event.payload?.branch ?? null)
    .filter((branch) => branch !== null)
    .at(-1);
  return base === undefined ? UNKNOWN_BASE_TITLE : `Rebased on ${base}`;
};

const isRebaseAgent = ({
  agent,
  events,
}: {
  readonly agent: Agent;
  readonly events: ReadonlyArray<SessionEvent>;
}): boolean =>
  events.some(
    (event) =>
      event.payload?.agentId === agent.id &&
      (event.kind === 'rebase_requested' ||
        (event.kind === 'history_rewritten' && event.payload.origin === 'rebase')),
  );

type AutoParams = {
  readonly entry: TimelineAgentEntry;
  readonly view: AutoTreeView;
  readonly model: DoneModel;
};

const autoOutcomeOf = ({ entry, view, model }: AutoParams): string | null => {
  const own = plainTitleOf({ text: entry.agent.outputSummary });
  const group = autoGroupOf({ view, agents: model.agents, now: model.now });
  const children = (group?.children ?? []).filter((child) => child.state !== 'retried');
  const only = children.length === 1 ? children[0] : undefined;
  if (only !== undefined) {
    return plainTitleOf({ text: only.outcome }) ?? own;
  }
  if (own !== null || children.length === 0) {
    return own;
  }
  return `${joinNouns({
    nouns: Array.from(new Set(children.map((child) => child.noun))),
  })} finished`;
};

const agentFallbackOf = ({
  entry,
  model,
}: {
  readonly entry: TimelineAgentEntry;
  readonly model: DoneModel;
}): string => {
  const kind: AgentKind = entry.agentKind;
  const noun = AGENT_KIND_META[kind].noun;
  switch (kind) {
    case 'planner':
      return 'Planned the change';
    case 'scribe':
      return 'Summarised the plan';
    case 'rewriter':
      return isRebaseAgent({ agent: entry.agent, events: model.events })
        ? rebaseTitleOf({ events: model.events, at: entry.agent.completedAt ?? entry.at ?? '' })
        : 'Rewrote the history';
    case 'ci-fixer': {
      const check = model.checkNameByAgentId.get(entry.agent.id);
      return check === undefined ? 'Fixed the failing check' : `Fixed the failing ${check} check`;
    }
    case 'ci-debugger':
    case 'scout':
    case 'implementer':
    case 'debugger':
    case 'tester':
    case 'reviewer':
    case 'pr-reviewer':
    case 'docs':
    case 'report':
    case 'wireframe':
    case 'resolver':
    case 'auto':
    case 'generic':
      return `${noun} finished`;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};

const agentByOf = ({
  entry,
  model,
}: {
  readonly entry: TimelineAgentEntry;
  readonly model: DoneModel;
}): string => {
  if (
    entry.agentKind === 'rewriter' &&
    isRebaseAgent({ agent: entry.agent, events: model.events })
  ) {
    return 'Rebase';
  }
  if (
    entry.agentKind === 'ci-fixer' ||
    ciFixRoleOf({ agent: entry.agent, kind: entry.agentKind }) === 'fix'
  ) {
    return 'Check fix';
  }
  return AGENT_KIND_META[entry.agentKind].noun;
};

const agentLineOf = ({
  entry,
  model,
}: {
  readonly entry: TimelineAgentEntry;
  readonly model: DoneModel;
}): OutcomeLine => {
  const view = model.autoTrees.find((candidate) => candidate.tree.rootAgentId === entry.agent.id);
  if (view !== undefined) {
    const group = autoGroupOf({ view, agents: model.agents, now: model.now });
    const spawned = descendantAgentsOf({ agents: model.agents, rootId: entry.agent.id });
    return {
      title: autoOutcomeOf({ entry, view, model }) ?? 'Auto finished',
      by: outcomeMetaOf({
        parts: [
          'Auto',
          agentCountLabelOf({
            count: runAgentCountOf({ agentIds: spawned.map((agent) => agent.id) }),
          }),
          needsYouLabelOf({ count: autoNeedsYouCountOf({ view, group }) }),
        ],
      }),
      kind: 'auto',
      leadAgentId: entry.agent.id,
    };
  }
  return {
    title: plainTitleOf({ text: entry.agent.outputSummary }) ?? agentFallbackOf({ entry, model }),
    by: agentByOf({ entry, model }),
    kind: entry.agentKind,
    leadAgentId: entry.agent.id,
  };
};

const lastSummaryOf = ({
  steps,
}: {
  readonly steps: ReadonlyArray<TimelineAgentEntry>;
}): string | null =>
  steps
    .slice()
    .sort((first, second) => first.agent.ordinal - second.agent.ordinal)
    .map((step) => plainTitleOf({ text: step.agent.outputSummary }))
    .filter((summary) => summary !== null)
    .at(-1) ?? null;

const stepAgentsOf = ({
  entry,
}: {
  readonly entry: TimelineRunEntry;
}): ReadonlyArray<TimelineAgentEntry> =>
  entry.children.flatMap((child) => (child.kind === 'agent' ? [child] : []));

type RunEntryParams = {
  readonly entry: TimelineRunEntry;
};

export const isRunEntryFinished = ({ entry }: RunEntryParams): boolean =>
  entry.run.discardedAt != null ||
  isWorkflowRunComplete({
    run: entry.run,
    workflow: entry.workflow,
    agents: stepAgentsOf({ entry }).map((child) => child.agent),
  });

type ProgressParams = {
  readonly done: number;
  readonly total: number | null;
};

const progressLabelOf = ({ done, total }: ProgressParams): string | null => {
  if (done === 0 && total === null) {
    return null;
  }
  const noun = (total ?? done) === 1 ? 'step' : 'steps';
  return total === null ? `${done} ${noun}` : `${done} of ${total} ${noun}`;
};

const runLineOf = ({
  entry,
  model,
  slice,
}: {
  readonly entry: TimelineRunEntry;
  readonly model: DoneModel;
  readonly slice: ReadonlyArray<TimelineAgentEntry> | null;
}): OutcomeLine => {
  const label = entry.workflow.origin === 'orchestrated' ? 'Orchestrated' : entry.workflow.name;
  if (slice !== null) {
    const { numberOf, total } = runStepNumbersOf({ entry });
    const numbers = slice.flatMap((step) => numberOf.get(step.agent.id) ?? []);
    return {
      title: lastSummaryOf({ steps: slice }) ?? `${label} steps finished`,
      by: outcomeMetaOf({ parts: [label, stepsLabelOf({ numbers, total })] }),
      kind: null,
      leadAgentId: null,
    };
  }
  const steps = stepAgentsOf({ entry });
  const done = steps.filter(
    (step) => step.agent.status !== 'pending' && step.agent.status !== 'skipped',
  ).length;
  const { total } = runStepNumbersOf({ entry });
  const recap =
    entry.workflow.origin === 'orchestrated'
      ? plainTitleOf({ text: entry.run.orchestratorSummary })
      : null;
  const spawned = model.agents.filter((agent) => agent.workflowRunId === entry.run.id);
  return {
    title:
      recap ?? lastSummaryOf({ steps }) ?? `${entry.run.title ?? entry.workflow.name} finished`,
    by: outcomeMetaOf({
      parts: [
        label,
        agentCountLabelOf({
          count: runAgentCountOf({ agentIds: spawned.map((agent) => agent.id) }),
        }),
        progressLabelOf({ done, total }),
        needsYouLabelOf({ count: runNeedsYouCountOf({ steps }) }),
      ],
    }),
    kind: null,
    leadAgentId: null,
  };
};

const eventLineOf = ({
  entry,
  model,
}: {
  readonly entry: TimelineEventEntry;
  readonly model: DoneModel;
}): OutcomeLine => ({
  title: rebaseTitleOf({ events: model.events, at: entry.event.createdAt }),
  by: 'Rebase',
  kind: null,
  leadAgentId: null,
});

export const outcomeLineOf = ({ entry, model, slice = null }: Params): OutcomeLine => {
  switch (entry.kind) {
    case 'run':
      return runLineOf({ entry, model, slice });
    case 'agent':
      return agentLineOf({ entry, model });
    case 'event':
      return eventLineOf({ entry, model });
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
};
