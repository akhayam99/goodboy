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

type FixRunTarget = {
  readonly threadId: string;
  readonly mountId: MountId | null;
  readonly rank: number;
};

type FixRunOwed = {
  readonly questions: number;
  readonly toReview: number;
  readonly pushFailed: number;
  readonly couldntFix: number;
  readonly target: FixRunTarget | null;
};

export type NeedsYouOwner = {
  readonly id: string;
  readonly kind: NeedsYouOwnerKind;
  readonly text: string;
  readonly where: string | null;
  readonly at: string | null;
  readonly item: TimelineRowItem | null;
  readonly question: OpenQuestion | null;
  readonly questionIds: ReadonlyArray<string>;
  readonly prNumber: number | null;
  readonly owed: FixRunOwed | null;
  readonly mountId: string | null;
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
const RANK_PUSH_FAILED = 1;
const RANK_REVIEW = 2;
const RANK_FAILED = 3;

const owedOf = ({ facts }: { readonly facts: ResolveActivityFacts }): FixRunOwed | null => {
  let questions = 0;
  let toReview = 0;
  let pushFailed = 0;
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
        if (thread.isPushFailure === true) {
          pushFailed += 1;
          aim({ threadId: thread.threadId, rank: RANK_PUSH_FAILED });
          break;
        }
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
  return questions + toReview + pushFailed + couldntFix === 0
    ? null
    : { questions, toReview, pushFailed, couldntFix, target };
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
    ...(owed.toReview === 0 ? [] : [`${owed.toReview} to review`]),
    ...(owed.questions === 0
      ? []
      : [plural({ count: owed.questions, one: 'question', many: 'questions' })]),
    ...(owed.pushFailed === 0 ? [] : [`${owed.pushFailed} push failed`]),
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
        pushFailed: total.pushFailed + (member.owed?.pushFailed ?? 0),
        couldntFix: total.couldntFix + (member.owed?.couldntFix ?? 0),
        target:
          member.owed?.target != null &&
          (total.target === null || member.owed.target.rank < total.target.rank)
            ? member.owed.target
            : total.target,
      }),
      { questions: 0, toReview: 0, pushFailed: 0, couldntFix: 0, target: null },
    );
    return [
      {
        ...owner,
        owed,
        text: owedText({ prNumber: owner.prNumber, owed }),
        mountId: owed.target?.mountId ?? owner.mountId,
      },
    ];
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

type AskLine = {
  readonly text: string;
  readonly where: string | null;
};

const askLine = ({
  title,
  item,
  question,
}: {
  readonly title: string;
  readonly item: TimelineRowItem;
  readonly question: OpenQuestion | null;
}): AskLine => {
  const ask = item.rowState.ask;
  if (question !== null && (ask == null || ask.kind === 'answer')) {
    return { text: question.text, where: title };
  }
  if (ask?.kind === 'restartStep') {
    return { text: 'A step failed', where: title };
  }
  if (ask?.kind === 'runStep') {
    return { text: `${ask.step.name} is ready`, where: title };
  }
  if (ask?.kind === 'reviewComment') {
    const word = item.rowState.reason?.kind === 'review' ? item.rowState.reason.word : null;
    return word === null ? { text: title, where: null } : { text: word, where: title };
  }
  return { text: title, where: null };
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
  const question = runOpenQuestion({ entry })?.question ?? oldest({ questions });
  return {
    id: runItem.id,
    kind: 'run',
    ...askLine({ title: entry.run.title ?? entry.workflow.name, item: askItem, question }),
    at: runItem.at,
    item: runItem,
    question,
    questionIds: questions.map((question) => question.id),
    prNumber: null,
    owed: null,
    mountId: null,
  };
};

const ownerOfRow = ({
  item,
  itemById,
  events,
  factsByAgentId,
  liveAgentIds,
  settledStopIds,
  openMountIds,
}: {
  readonly item: TimelineRowItem;
  readonly itemById: ReadonlyMap<string, TimelineRowItem>;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly factsByAgentId: ReadonlyMap<string, ResolveActivityFacts>;
  readonly liveAgentIds: ReadonlySet<string> | undefined;
  readonly settledStopIds: ReadonlySet<string> | undefined;
  readonly openMountIds: ReadonlySet<string> | undefined;
}): NeedsYouOwner | null => {
  const { entry } = item;
  const base = {
    id: item.id,
    where: null,
    at: item.at,
    item,
    question: null,
    questionIds: [],
    prNumber: null,
    owed: null,
    mountId: entry.kind === 'agent' ? (entry.agent.mountId ?? null) : null,
  };
  if (entry.kind === 'event') {
    if (entry.event.kind !== 'history_stopped') {
      return null;
    }
    if (
      !hasHistoryRecovery({
        event: entry.event,
        events,
        liveAgentIds,
        settledStopIds,
        openMountIds,
      })
    ) {
      return null;
    }
    return {
      ...base,
      kind: 'rebase',
      mountId: entry.event.payload?.mountId ?? null,
      text: segmentsToText({
        segments: sessionEventLabel({ event: entry.event }),
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
      : {
          ...base,
          kind: 'fixRun',
          text: owedText({ prNumber, owed }),
          prNumber,
          owed,
          mountId: owed.target?.mountId ?? base.mountId,
        };
  }
  if (entry.kind !== 'agent' || !isAskingRow({ item })) {
    return null;
  }
  const runItem = item.familyId === null ? undefined : itemById.get(item.familyId);
  if (runItem !== undefined && runItem.entry.kind === 'run') {
    return runOwnerOf({ runItem, askItem: item });
  }
  const questions = openQuestionsOfAgent({ entry });
  const question = oldest({ questions });
  return {
    ...base,
    kind: 'agent',
    ...askLine({
      title: agentDisplayName({ name: entry.agent.name, kind: entry.agentKind }),
      item,
      question,
    }),
    question,
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
      first === undefined
        ? plural({ count: entry.questions.length, one: 'question', many: 'questions' })
        : first.text,
    where: null,
    at: entry.at,
    item: null,
    question: first ?? null,
    questionIds: entry.questions.map((question) => question.id),
    prNumber: null,
    owed: null,
    mountId: null,
  };
};

const NO_FACTS: ReadonlyMap<string, ResolveActivityFacts> = new Map();

type Params = {
  readonly items: ReadonlyArray<TimelineStreamItem>;
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly resolveFactsByAgentId?: ReadonlyMap<string, ResolveActivityFacts>;
  readonly liveAgentIds?: ReadonlySet<string>;
  readonly settledStopIds?: ReadonlySet<string>;
  readonly openMountIds?: ReadonlySet<string>;
};

export const needsYouOwners = ({
  items,
  entries,
  events,
  resolveFactsByAgentId = NO_FACTS,
  liveAgentIds,
  settledStopIds,
  openMountIds,
}: Params): ReadonlyArray<NeedsYouOwner> => {
  const rowItems = items.filter((item): item is TimelineRowItem => item.kind === 'row');
  const itemById = new Map(rowItems.map((item) => [item.id, item]));
  const byId = new Map<string, NeedsYouOwner>();
  for (const item of rowItems) {
    const owner = ownerOfRow({
      item,
      itemById,
      events,
      factsByAgentId: resolveFactsByAgentId,
      liveAgentIds,
      settledStopIds,
      openMountIds,
    });
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
