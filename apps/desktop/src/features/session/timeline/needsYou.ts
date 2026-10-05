import type { MountId, OpenQuestion, SessionEvent } from '@goodboy/types';
import { agentDisplayName } from '../../../shared/utils/agentDisplayName';
import { hasHistoryRecovery } from '../../history/historyRecovery';
import { isRowNeedingYou } from '../../workTreeModel/rowState';
import type {
  TimelineAgentEntry,
  TimelineQuestionEntry,
  TimelineRunEntry,
  TimelineTopLevelEntry,
} from './buildTimelineGroups';
import type { TimelineRowItem, TimelineStreamItem } from './buildTimelineStream';
import { runOpenQuestion } from './runOpenQuestion';
import type { ResolveActivityFacts } from './resolveActivity';
import { segmentsToText, sessionEventLabel } from './sessionEventPresentation';

export type NeedsYouOwnerKind = 'fixRun' | 'run' | 'agent' | 'question' | 'rebase';

export type FixRunTarget = {
  readonly threadId: string;
  readonly mountId: MountId | null;
  readonly rank: number;
};

export type FixRunOwed = {
  readonly questions: number;
  readonly toReview: number;
  readonly couldntFix: number;
  readonly target: FixRunTarget | null;
};

export type NeedsYouOwner = {
  readonly id: string;
  readonly kind: NeedsYouOwnerKind;
  readonly text: string;
  readonly at: string | null;
  readonly item: TimelineRowItem | null;
  readonly question: OpenQuestion | null;
  readonly questionIds: ReadonlyArray<string>;
  readonly prNumber: number | null;
  readonly owed: FixRunOwed | null;
};

const plural = ({
  count,
  one,
  many,
}: {
  readonly count: number;
  readonly one: string;
  readonly many: string;
}): string => `${count} ${count === 1 ? one : many}`;

const RANK_QUESTION = 0;
const RANK_REVIEW = 1;
const RANK_FAILED = 2;

const owedOf = ({ facts }: { readonly facts: ResolveActivityFacts }): FixRunOwed | null => {
  let questions = 0;
  let toReview = 0;
  let couldntFix = 0;
  let target: FixRunTarget | null = null;
  const aim = ({ threadId, rank }: { readonly threadId: string; readonly rank: number }): void => {
    if (target === null || rank < target.rank) {
      target = { threadId, mountId: facts.mountId ?? null, rank };
    }
  };
  for (const thread of facts.threads ?? []) {
    switch (thread.state) {
      case 'needs':
        questions += 1;
        aim({ threadId: thread.threadId, rank: RANK_QUESTION });
        break;
      case 'ready':
      case 'edited':
      case 'outdated':
        toReview += 1;
        aim({ threadId: thread.threadId, rank: RANK_REVIEW });
        break;
      case 'failed':
        couldntFix += 1;
        aim({ threadId: thread.threadId, rank: RANK_FAILED });
        break;
      case 'new':
      case 'drafting':
      case 'accepted':
      case 'replied':
      case 'skipped':
      case 'pushed':
      case 'resolved':
        break;
      default: {
        const exhaustive: never = thread.state;
        return exhaustive;
      }
    }
  }
  return questions + toReview + couldntFix === 0
    ? null
    : { questions, toReview, couldntFix, target };
};

const owedText = ({
  prNumber,
  owed,
}: {
  readonly prNumber: number | null;
  readonly owed: FixRunOwed;
}): string =>
  [
    prNumber === null ? 'Fix run' : `#${prNumber}`,
    ...(owed.questions === 0
      ? []
      : [plural({ count: owed.questions, one: 'question', many: 'questions' })]),
    ...(owed.toReview === 0 ? [] : [`${owed.toReview} to review`]),
    ...(owed.couldntFix === 0 ? [] : [`${owed.couldntFix} couldn't fix`]),
  ].join(' · ');

const mergeFixRunOwners = ({
  owners,
}: {
  readonly owners: ReadonlyArray<NeedsYouOwner>;
}): ReadonlyArray<NeedsYouOwner> => {
  const groups = new Map<number, ReadonlyArray<NeedsYouOwner>>();
  for (const owner of owners) {
    if (owner.kind === 'fixRun' && owner.prNumber !== null) {
      groups.set(owner.prNumber, [...(groups.get(owner.prNumber) ?? []), owner]);
    }
  }
  const emitted = new Set<number>();
  return owners.flatMap((owner) => {
    if (owner.kind !== 'fixRun' || owner.prNumber === null) {
      return [owner];
    }
    const group = groups.get(owner.prNumber) ?? [owner];
    if (group.length === 1) {
      return [owner];
    }
    if (emitted.has(owner.prNumber)) {
      return [];
    }
    emitted.add(owner.prNumber);
    const owed = group.reduce<FixRunOwed>(
      (total, member) => ({
        questions: total.questions + (member.owed?.questions ?? 0),
        toReview: total.toReview + (member.owed?.toReview ?? 0),
        couldntFix: total.couldntFix + (member.owed?.couldntFix ?? 0),
        target:
          member.owed?.target != null &&
          (total.target === null || member.owed.target.rank < total.target.rank)
            ? member.owed.target
            : total.target,
      }),
      { questions: 0, toReview: 0, couldntFix: 0, target: null },
    );
    return [{ ...owner, owed, text: owedText({ prNumber: owner.prNumber, owed }) }];
  });
};

const openQuestionsOfAgent = ({
  entry,
}: {
  readonly entry: TimelineAgentEntry;
}): ReadonlyArray<OpenQuestion> => [
  ...entry.openQuestions,
  ...entry.children.flatMap((child) => openQuestionsOfAgent({ entry: child })),
];

const openQuestionsOfRun = ({
  entry,
}: {
  readonly entry: TimelineRunEntry;
}): ReadonlyArray<OpenQuestion> =>
  entry.children.flatMap((child) =>
    child.kind === 'agent' ? openQuestionsOfAgent({ entry: child }) : [],
  );

const oldest = ({
  questions,
}: {
  readonly questions: ReadonlyArray<OpenQuestion>;
}): OpenQuestion | null =>
  questions.reduce<OpenQuestion | null>(
    (first, question) =>
      first === null || question.createdAt < first.createdAt ? question : first,
    null,
  );

const askText = ({
  title,
  item,
  questions,
}: {
  readonly title: string;
  readonly item: TimelineRowItem;
  readonly questions: number;
}): string => {
  const ask = item.rowState.ask;
  if (questions > 0 && (ask == null || ask.kind === 'answer')) {
    return `${title} · ${plural({ count: questions, one: 'question', many: 'questions' })}`;
  }
  if (ask?.kind === 'restartStep') {
    return `${title} · a step failed`;
  }
  if (ask?.kind === 'runStep') {
    return `${title} · ${ask.step.name} is ready`;
  }
  if (ask?.kind === 'reviewComment') {
    const word = item.rowState.reason?.kind === 'review' ? item.rowState.reason.word : null;
    return word === null ? title : `${title} · ${word}`;
  }
  return title;
};

const isAskingRow = ({ item }: { readonly item: TimelineRowItem }): boolean =>
  isRowNeedingYou({ state: item.rowState }) || item.hasSubagentAttention === true;

const runOwnerOf = ({
  runItem,
  askItem,
}: {
  readonly runItem: TimelineRowItem;
  readonly askItem: TimelineRowItem;
}): NeedsYouOwner | null => {
  const { entry } = runItem;
  if (entry.kind !== 'run') {
    return null;
  }
  const questions = openQuestionsOfRun({ entry });
  return {
    id: runItem.id,
    kind: 'run',
    text: askText({
      title: entry.run.title ?? entry.workflow.name,
      item: askItem,
      questions: questions.length,
    }),
    at: runItem.at,
    item: runItem,
    question: runOpenQuestion({ entry })?.question ?? oldest({ questions }),
    questionIds: questions.map((question) => question.id),
    prNumber: null,
    owed: null,
  };
};

const ownerOfRow = ({
  item,
  itemById,
  events,
  factsByAgentId,
}: {
  readonly item: TimelineRowItem;
  readonly itemById: ReadonlyMap<string, TimelineRowItem>;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly factsByAgentId: ReadonlyMap<string, ResolveActivityFacts>;
}): NeedsYouOwner | null => {
  const { entry } = item;
  const base = {
    id: item.id,
    at: item.at,
    item,
    question: null,
    questionIds: [],
    prNumber: null,
    owed: null,
  };
  if (entry.kind === 'event') {
    if (entry.event.kind !== 'history_stopped') {
      return null;
    }
    if (!hasHistoryRecovery({ event: entry.event, events })) {
      return null;
    }
    return {
      ...base,
      kind: 'rebase',
      text: segmentsToText({
        segments: sessionEventLabel({ event: entry.event, repeatCount: entry.repeatCount }),
      }),
    };
  }
  if (entry.kind === 'run') {
    return isAskingRow({ item }) ? runOwnerOf({ runItem: item, askItem: item }) : null;
  }
  const facts = entry.kind === 'agent' ? factsByAgentId.get(entry.agent.id) : undefined;
  if (facts !== undefined) {
    const owed = owedOf({ facts });
    const prNumber = facts.prNumber ?? null;
    return owed === null
      ? null
      : { ...base, kind: 'fixRun', text: owedText({ prNumber, owed }), prNumber, owed };
  }
  if (entry.kind !== 'agent' || !isAskingRow({ item })) {
    return null;
  }
  const runItem = item.familyId === null ? undefined : itemById.get(item.familyId);
  if (runItem !== undefined && runItem.entry.kind === 'run') {
    return runOwnerOf({ runItem, askItem: item });
  }
  const questions = openQuestionsOfAgent({ entry });
  return {
    ...base,
    kind: 'agent',
    text: askText({
      title: agentDisplayName({ name: entry.agent.name, kind: entry.agentKind }),
      item,
      questions: questions.length,
    }),
    question: oldest({ questions }),
    questionIds: questions.map((question) => question.id),
  };
};

const isLooseOpenQuestion = (entry: TimelineTopLevelEntry): entry is TimelineQuestionEntry =>
  entry.kind === 'question' &&
  entry.lane == null &&
  entry.questions.length > 0 &&
  entry.questions.every((question) => question.status === 'open');

const ownerOfQuestion = ({ entry }: { readonly entry: TimelineQuestionEntry }): NeedsYouOwner => {
  const [first] = entry.questions;
  return {
    id: entry.id,
    kind: 'question',
    text:
      entry.questions.length === 1 && first !== undefined
        ? `Question · ${first.text}`
        : plural({ count: entry.questions.length, one: 'question', many: 'questions' }),
    at: entry.at,
    item: null,
    question: first ?? null,
    questionIds: entry.questions.map((question) => question.id),
    prNumber: null,
    owed: null,
  };
};

const NO_FACTS: ReadonlyMap<string, ResolveActivityFacts> = new Map();

type Params = {
  readonly items: ReadonlyArray<TimelineStreamItem>;
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly resolveFactsByAgentId?: ReadonlyMap<string, ResolveActivityFacts>;
};

export const needsYouOwners = ({
  items,
  entries,
  events,
  resolveFactsByAgentId = NO_FACTS,
}: Params): ReadonlyArray<NeedsYouOwner> => {
  const rowItems = items.filter((item): item is TimelineRowItem => item.kind === 'row');
  const itemById = new Map(rowItems.map((item) => [item.id, item]));
  const byId = new Map<string, NeedsYouOwner>();
  for (const item of rowItems) {
    const owner = ownerOfRow({ item, itemById, events, factsByAgentId: resolveFactsByAgentId });
    if (owner !== null && !byId.has(owner.id)) {
      byId.set(owner.id, owner);
    }
  }
  for (const entry of entries.filter(isLooseOpenQuestion)) {
    byId.set(entry.id, ownerOfQuestion({ entry }));
  }
  const sorted = [...byId.values()].sort((first, second) => {
    if (first.at != null && second.at != null && first.at !== second.at) {
      return second.at.localeCompare(first.at);
    }
    return first.id.localeCompare(second.id);
  });
  return mergeFixRunOwners({ owners: sorted });
};
