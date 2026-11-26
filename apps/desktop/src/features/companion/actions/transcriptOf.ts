import { listTurnEventEntriesForAgent } from '@goodboy/db';
import type { TurnEvent } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { mergeTranscript } from '../../../store/slices/transcripts/mergeTranscript';
import { STREAM_BUDGETS } from '../../../store/slices/transcripts/streamBudgets';
import type { AppStore } from '../../../store/store';
import type {
  TranscriptEntry,
  TranscriptProjection,
  TranscriptQuery,
} from '../contract/transcript';
import { withoutAbsolutePaths } from '../pathText';
import { isAgentOfSession, sessionOfAction } from './targets';
import { sessionIdOf, agentIdOf } from './ids';

const MAX_PAGE = 500;
const MAX_SUMMARY_LENGTH = 160;
type TextParams = {
  readonly text: string;
};

const baseNameOf = ({ text }: TextParams): string => text.slice(text.lastIndexOf('/') + 1);

type InputParams = {
  readonly input: unknown;
  readonly key: string;
};

const stringFieldOf = ({ input, key }: InputParams): string | null => {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const value: unknown = Reflect.get(input, key);
  return typeof value === 'string' ? value : null;
};

const lineCountOf = ({ text }: TextParams): number => (text === '' ? 0 : text.split('\n').length);

type ToolParams = {
  readonly toolName: string;
  readonly input: unknown;
};

const toolSummaryOf = ({ toolName, input }: ToolParams): string => {
  const path = stringFieldOf({ input, key: 'file_path' }) ?? stringFieldOf({ input, key: 'path' });
  if (toolName === 'Bash') {
    const command = stringFieldOf({ input, key: 'command' }) ?? '';
    return withoutAbsolutePaths({ text: command.split('\n')[0] ?? '' }).slice(
      0,
      MAX_SUMMARY_LENGTH,
    );
  }
  if (path !== null) {
    const verb = toolName === 'Read' ? 'Read' : 'Edited';
    return `${verb} ${baseNameOf({ text: path })}`;
  }
  return toolName;
};

const changedLinesOf = ({
  toolName,
  input,
}: ToolParams): { readonly added: number | null; readonly removed: number | null } => {
  if (toolName === 'Edit') {
    const added = stringFieldOf({ input, key: 'new_string' });
    const removed = stringFieldOf({ input, key: 'old_string' });
    return {
      added: added === null ? null : lineCountOf({ text: added }),
      removed: removed === null ? null : lineCountOf({ text: removed }),
    };
  }
  if (toolName === 'Write') {
    const content = stringFieldOf({ input, key: 'content' });
    return { added: content === null ? null : lineCountOf({ text: content }), removed: null };
  }
  return { added: null, removed: null };
};

type EventsParams = {
  readonly events: ReadonlyArray<TurnEvent>;
};

export const transcriptEntriesOf = ({ events }: EventsParams): ReadonlyArray<TranscriptEntry> => {
  const entries: TranscriptEntry[] = [];
  const toolIndexById = new Map<string, number>();
  let open: { index: number; runId: string } | null = null;
  events.forEach((event, index) => {
    if (event.kind === 'assistant_text') {
      if (open !== null && open.runId === event.runId) {
        const current = entries[open.index];
        if (current?.kind === 'words') {
          entries[open.index] = { ...current, text: current.text + event.delta };
        }
        return;
      }
      entries.push({
        kind: 'words',
        id: `e${index}`,
        who: 'agent',
        text: event.delta,
        at: event.at,
      });
      open = { index: entries.length - 1, runId: event.runId };
      return;
    }
    open = null;
    if (event.kind === 'user_text' || event.kind === 'operator_text') {
      entries.push({
        kind: 'words',
        id: `e${index}`,
        who: 'you',
        text: event.text,
        at: event.at,
      });
      return;
    }
    if (event.kind === 'tool_call_start') {
      const lines = changedLinesOf({ toolName: event.toolName, input: event.input });
      toolIndexById.set(event.toolUseId, entries.length);
      entries.push({
        kind: 'tool',
        id: `e${index}`,
        name: event.toolName,
        summary: toolSummaryOf({ toolName: event.toolName, input: event.input }),
        isError: false,
        addedLines: lines.added,
        removedLines: lines.removed,
        at: event.at,
      });
      return;
    }
    if (event.kind === 'tool_call_end' && event.isError) {
      const at = toolIndexById.get(event.toolUseId);
      const current = at === undefined ? undefined : entries[at];
      if (at !== undefined && current?.kind === 'tool') {
        entries[at] = { ...current, isError: true };
      }
    }
  });
  return entries.map((entry) =>
    entry.kind === 'words' ? { ...entry, text: withoutAbsolutePaths({ text: entry.text }) } : entry,
  );
};

type PageParams = {
  readonly entries: ReadonlyArray<TranscriptEntry>;
  readonly limit: number;
  readonly beforeEntryId: string | null;
};

const pageOf = ({ entries, limit, beforeEntryId }: PageParams) => {
  const end =
    beforeEntryId === null ? entries.length : entries.findIndex((e) => e.id === beforeEntryId);
  const upTo = end < 0 ? entries.length : end;
  const start = Math.max(0, upTo - limit);
  return { entries: entries.slice(start, upTo), hasEarlier: start > 0 };
};

type QueryParams = {
  readonly query: TranscriptQuery;
  readonly getStore: () => AppStore;
  readonly now?: Date;
};

export const transcriptOf = async ({
  query,
  getStore,
  now = new Date(),
}: QueryParams): Promise<TranscriptProjection | null> => {
  const sessionId = sessionIdOf({ value: query.sessionId });
  const agentId = agentIdOf({ value: query.agentId });
  const first = getStore();
  const session = sessionOfAction({
    store: first,
    workspaceId: query.workspaceId,
    sessionId: query.sessionId,
  });
  if (session === null || !isAgentOfSession({ store: first, sessionId, agentId })) {
    return null;
  }
  if (first.transcripts[agentId] === undefined) {
    await first.loadAgentTranscript(sessionId, agentId, { isSelecting: false });
  }
  const loaded = getStore().transcripts[agentId] ?? [];
  const events =
    loaded.length < STREAM_BUDGETS.initialTranscriptRows
      ? loaded
      : mergeTranscript({
          stored: await listTurnEventEntriesForAgent({ db: tauriDatabase, agentId }),
          live: loaded,
        });
  const limit = Math.min(Math.max(1, Math.trunc(query.limit)), MAX_PAGE);
  const page = pageOf({
    entries: transcriptEntriesOf({ events }),
    limit,
    beforeEntryId: query.beforeEntryId,
  });
  return {
    workspaceId: query.workspaceId,
    sessionId: query.sessionId,
    agentId: query.agentId,
    entries: page.entries,
    hasEarlier: page.hasEarlier,
    generatedAt: now.toISOString(),
  };
};
