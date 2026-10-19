import { AGENT_KIND_META } from '../../agent-kind';
import type { BranchFacts } from '../branches/branchFactsOf';
import type { ActionCardModel } from '../next/actionCardsOf';
import { finishedSentenceOf } from './finishedSentenceOf';
import type { LiveAgentGroup, LiveAutoGroup, LiveGroupModel, LiveRunGroup } from './liveGroupsOf';
import { runPositionOf } from './runPositionOf';

const MAX_NAMED_GROUPS = 2;
const NOTHING_RAN = 'Nothing has run yet.';
const STUCK_AUTO_CHILD_STATES: ReadonlySet<string> = new Set([
  'neverStarted',
  'failed',
  'timedOut',
  'blocked',
]);

type TextParams = {
  readonly text: string;
};

const lowerFirst = ({ text }: TextParams): string => text.charAt(0).toLowerCase() + text.slice(1);

type RunPhraseParams = {
  readonly group: LiveRunGroup;
};

const isStepRunning = ({ group }: RunPhraseParams): boolean =>
  group.currentStep !== null && group.stepStates[group.currentStep.number - 1] === 'running';

const orchestratedPhraseOf = ({ group }: RunPhraseParams): string => {
  if (group.state === 'deciding') {
    return 'The orchestrator is deciding the next step';
  }
  if (group.state === 'stuck') {
    const reason = group.entry.run.orchestrationReason?.trim() ?? '';
    if (reason !== '') {
      return `The orchestrator stopped: ${reason}`;
    }
    return group.failedStep === null
      ? 'The orchestrator stopped'
      : `The orchestrator stopped at step ${group.failedStep.number}, ${group.failedStep.title}`;
  }
  if (group.state === 'waiting' && !isStepRunning({ group })) {
    return group.waitingStepNumber === null
      ? 'The orchestrator waits on you'
      : `The orchestrator waits on your answer in step ${group.waitingStepNumber}`;
  }
  if (group.currentStep === null) {
    return 'The orchestrator is starting';
  }
  const position = lowerFirst({ text: runPositionOf({ group }) ?? 'step 1' });
  return `The orchestrator is on ${position}, ${group.currentStep.title}`;
};

const runPhraseOf = ({ group }: RunPhraseParams): string => {
  if (group.state === 'stuck') {
    return group.failedStep === null
      ? `${group.title} stopped`
      : `${group.title} stopped at step ${group.failedStep.number}, ${group.failedStep.title}`;
  }
  if (group.state === 'waiting' && !isStepRunning({ group })) {
    return group.waitingStepNumber === null
      ? `${group.title} is waiting for you`
      : `${group.title} step ${group.waitingStepNumber} waits on your answer`;
  }
  if (group.currentStep === null) {
    return `${group.title} is starting`;
  }
  const position = lowerFirst({ text: runPositionOf({ group }) ?? 'step 1' });
  return `${group.title} is on ${position}, ${group.currentStep.title}`;
};

type AutoPhraseParams = {
  readonly group: LiveAutoGroup;
};

const autoPhraseOf = ({ group }: AutoPhraseParams): string => {
  if (group.state === 'stuck') {
    const child = group.children.find((candidate) => STUCK_AUTO_CHILD_STATES.has(candidate.state));
    if (child === undefined) {
      return 'Auto is stuck';
    }
    return child.state === 'neverStarted'
      ? `Auto is stuck: ${child.label} never started`
      : `Auto is stuck: ${child.label} stopped`;
  }
  if (group.treePhase === 'blocked') {
    return 'Auto is blocked';
  }
  if (group.state === 'waiting') {
    return 'Auto waits on your OK';
  }
  return `Auto is ${lowerFirst({ text: group.group.word })}`;
};

type AgentPhraseParams = {
  readonly group: LiveAgentGroup;
};

const agentPhraseOf = ({ group }: AgentPhraseParams): string => {
  const noun = AGENT_KIND_META[group.entry.agentKind].noun;
  const { reason } = group.rowState;
  if (group.state === 'stuck') {
    return `${noun} failed on ${group.title}`;
  }
  if (reason?.kind === 'agentStopped') {
    return reason.by === 'app' ? `${noun} stopped when Goodboy closed` : `${noun} was stopped`;
  }
  if (group.state === 'waiting') {
    return `${noun} waits on you`;
  }
  return `${noun} is working on ${group.title}`;
};

type GroupParams = {
  readonly group: LiveGroupModel;
};

const phraseOf = ({ group }: GroupParams): string => {
  switch (group.kind) {
    case 'orchestrated':
      return orchestratedPhraseOf({ group });
    case 'run':
      return runPhraseOf({ group });
    case 'auto':
      return autoPhraseOf({ group });
    case 'agent':
      return agentPhraseOf({ group });
    default: {
      const exhaustive: never = group;
      return exhaustive;
    }
  }
};

type GroupsParams = {
  readonly groups: ReadonlyArray<LiveGroupModel>;
};

const groupsSentenceOf = ({ groups }: GroupsParams): string | null => {
  const named = groups.slice(0, MAX_NAMED_GROUPS).map((group) => phraseOf({ group }));
  const [first, second] = named;
  if (first === undefined) {
    return null;
  }
  const hiddenCount = groups.length - named.length;
  if (second === undefined) {
    return `${first}.`;
  }
  return hiddenCount > 0
    ? `${first}, ${second}, and ${hiddenCount} more.`
    : `${first}, and ${second}.`;
};

type CardParams = {
  readonly card: ActionCardModel;
};

const withPeriod = ({ text }: TextParams): string => (/[.!?]$/.test(text) ? text : `${text}.`);

const cardSentenceOf = ({ card }: CardParams): string => {
  const { source } = card;
  switch (source.kind) {
    case 'owner': {
      const subject = source.owner.where ?? null;
      if (source.owner.question !== null || source.owner.questionIds.length > 0) {
        return subject === null
          ? 'One answer waits on you.'
          : `${subject} waits on one answer from you.`;
      }
      return subject === null ? withPeriod({ text: card.title }) : `${subject} waits on you.`;
    }
    case 'suggestion':
      return withPeriod({ text: card.title });
    case 'auto':
      return withPeriod({ text: card.title });
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
};

type NextParams = {
  readonly cards: ReadonlyArray<ActionCardModel>;
};

const waitingSentenceOf = ({ cards }: NextParams): string | null => {
  const urgent = cards.filter((card) => card.band === 0);
  const [first] = urgent;
  if (first === undefined) {
    return null;
  }
  return urgent.length > 1
    ? `${urgent.length} things wait on you.`
    : cardSentenceOf({ card: first });
};

type Params = {
  readonly groups: ReadonlyArray<LiveGroupModel>;
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly doneOutcome: string | null;
  readonly facts: ReadonlyArray<BranchFacts>;
};

const isWaitingRun = ({ group }: GroupParams): boolean =>
  (group.kind === 'run' || group.kind === 'orchestrated') &&
  group.state === 'waiting' &&
  !isStepRunning({ group });

const isAnswerSaidByRun = ({ groups, cards }: GroupsParams & NextParams): boolean => {
  const urgent = cards.filter((card) => card.band === 0);
  const [only] = urgent;
  return (
    urgent.length === 1 &&
    only?.source.kind === 'owner' &&
    only.source.owner.questionIds.length > 0 &&
    groups.slice(0, MAX_NAMED_GROUPS).some((group) => isWaitingRun({ group }))
  );
};

export const statusSentenceOf = ({ groups, cards, doneOutcome, facts }: Params): string => {
  const first = groupsSentenceOf({ groups });
  const second = isAnswerSaidByRun({ groups, cards }) ? null : waitingSentenceOf({ cards });
  if (first === null && second === null) {
    const finished = finishedSentenceOf({ facts });
    if (finished !== null) {
      return finished;
    }
    return doneOutcome === null ? NOTHING_RAN : withPeriod({ text: doneOutcome });
  }
  if (first === null) {
    return second ?? NOTHING_RAN;
  }
  if (second === null || first.includes(second.replace(/\.$/, ''))) {
    return first;
  }
  return `${first} ${second}`;
};
