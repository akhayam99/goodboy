import type { OpenQuestion, SessionEvent } from '@goodboy/types';
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
import { segmentsToText, sessionEventLabel } from './sessionEventPresentation';
import type { ResolveBatchSummary } from './resolveBatchSummary';

export type NeedsYouOwnerKind = 'batch' | 'run' | 'agent' | 'question' | 'rebase';

export type NeedsYouOwner = {
  readonly id: string;
  readonly kind: NeedsYouOwnerKind;
  readonly text: string;
  readonly at: string | null;
  readonly item: TimelineRowItem | null;
  readonly question: OpenQuestion | null;
  readonly questionIds: ReadonlyArray<string>;
  readonly prNumber: number | null;
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

const BATCH_ATTENTION: Readonly<Record<string, (params: { readonly count: number }) => string>> = {
  ready: ({ count }) => `${count} ready`,
  needs_you: ({ count }) => `${count} needs you`,
  couldnt_fix: ({ count }) => `${count} couldn't fix`,
};

const batchText = ({
  prNumber,
  summaries,
}: {
  readonly prNumber: number | null;
  readonly summaries: ReadonlyArray<ResolveBatchSummary>;
}): string => {
  const head = prNumber === null ? 'Resolve' : `Resolve #${prNumber}`;
  const counts = new Map<string, number>();
  for (const part of summaries.flatMap((summary) => summary.parts)) {
    counts.set(part.state, (counts.get(part.state) ?? 0) + part.count);
  }
  const parts = Object.entries(BATCH_ATTENTION).flatMap(([state, text]) => {
    const count = counts.get(state) ?? 0;
    return count === 0 ? [] : [text({ count })];
  });
  return [head, ...parts].join(' · ');
};

const mergeBatchOwners = ({
  owners,
  summaryById,
}: {
  readonly owners: ReadonlyArray<NeedsYouOwner>;
  readonly summaryById: ReadonlyMap<string, ResolveBatchSummary>;
}): ReadonlyArray<NeedsYouOwner> => {
  const groups = new Map<number, ReadonlyArray<NeedsYouOwner>>();
  for (const owner of owners) {
    if (owner.kind === 'batch' && owner.prNumber !== null) {
      groups.set(owner.prNumber, [...(groups.get(owner.prNumber) ?? []), owner]);
    }
  }
  const emitted = new Set<number>();
  return owners.flatMap((owner) => {
    if (owner.kind !== 'batch' || owner.prNumber === null) {
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
    const summaries = group.flatMap((member) => {
      const summary = summaryById.get(member.id);
      return summary === undefined ? [] : [summary];
    });
    return [{ ...owner, text: batchText({ prNumber: owner.prNumber, summaries }) }];
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
  };
};

const ownerOfRow = ({
  item,
  itemById,
  events,
}: {
  readonly item: TimelineRowItem;
  readonly itemById: ReadonlyMap<string, TimelineRowItem>;
  readonly events: ReadonlyArray<SessionEvent>;
}): NeedsYouOwner | null => {
  const { entry } = item;
  const base = { id: item.id, at: item.at, item, question: null, questionIds: [], prNumber: null };
  if (entry.kind === 'resolveBatch') {
    if (entry.summary.attentionCount === 0) {
      return null;
    }
    return {
      ...base,
      kind: 'batch',
      text: batchText({ prNumber: entry.prNumber, summaries: [entry.summary] }),
      prNumber: entry.prNumber,
    };
  }
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
  };
};

type Params = {
  readonly items: ReadonlyArray<TimelineStreamItem>;
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly events: ReadonlyArray<SessionEvent>;
};

export const needsYouOwners = ({
  items,
  entries,
  events,
}: Params): ReadonlyArray<NeedsYouOwner> => {
  const rowItems = items.filter((item): item is TimelineRowItem => item.kind === 'row');
  const itemById = new Map(rowItems.map((item) => [item.id, item]));
  const byId = new Map<string, NeedsYouOwner>();
  for (const item of rowItems) {
    const owner = ownerOfRow({ item, itemById, events });
    if (owner !== null && !byId.has(owner.id)) {
      byId.set(owner.id, owner);
    }
  }
  for (const entry of entries.filter(isLooseOpenQuestion)) {
    byId.set(entry.id, ownerOfQuestion({ entry }));
  }
  const summaryById = new Map<string, ResolveBatchSummary>(
    rowItems.flatMap((item) =>
      item.entry.kind === 'resolveBatch' ? [[item.id, item.entry.summary] as const] : [],
    ),
  );
  const sorted = [...byId.values()].sort((first, second) => {
    if (first.at != null && second.at != null && first.at !== second.at) {
      return second.at.localeCompare(first.at);
    }
    return first.id.localeCompare(second.id);
  });
  return mergeBatchOwners({ owners: sorted, summaryById });
};
