import type { Agent, ResolveThread } from '@goodboy/types';
import { COMMENT_RUN_COPY } from './commentRunCopy';
import { commentRunOf } from './commentRunOf';
import { isOpenThread } from './isOpenThread';
import type { ReviewCommentState } from './reviewCommentState';
import type { RowFix } from './rowFix';

type SourceEntry = {
  readonly threadId: string;
  readonly state: ReviewCommentState;
  readonly fix: RowFix | null;
  readonly row: {
    readonly reviewerNote: { readonly path: string | null } | null;
    readonly thread: Pick<ResolveThread, 'stage'>;
  };
};

type Params<Entry extends SourceEntry> = {
  readonly entries: ReadonlyArray<Entry>;
  readonly agents: ReadonlyArray<Agent>;
  readonly threadId: string;
  readonly extraThreadIds: ReadonlyArray<string>;
};

export type CommentRunSources<Entry extends SourceEntry> = {
  readonly blocked: string | null;
  readonly picked: ReadonlyArray<Entry>;
  readonly candidates: ReadonlyArray<Entry>;
};

type EntryParams = {
  readonly entry: SourceEntry;
};

type PathParams = {
  readonly path: string | null;
};

const MAX_CANDIDATES = 3;

const JOINABLE: ReadonlySet<ReviewCommentState> = new Set<ReviewCommentState>([
  'new',
  'needs',
  'failed',
]);

const folderOf = ({ path }: PathParams): string | null => {
  if (path === null) {
    return null;
  }
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '' : path.slice(0, slash);
};

const pathOf = ({ entry }: EntryParams): string | null => entry.row.reviewerNote?.path ?? null;

const isFixing = ({ entry }: EntryParams): boolean =>
  entry.state === 'drafting' || entry.fix?.kind === 'fixing';

export const commentRunSourcesOf = <Entry extends SourceEntry>({
  entries,
  agents,
  threadId,
  extraThreadIds,
}: Params<Entry>): CommentRunSources<Entry> => {
  const isInRun = ({ entry }: EntryParams): boolean =>
    commentRunOf({ agents, threadId: entry.threadId }) !== null;
  const isJoinable = ({ entry }: EntryParams): boolean =>
    entry.threadId !== threadId &&
    entry.row.reviewerNote !== null &&
    isOpenThread({ thread: entry.row.thread }) &&
    JOINABLE.has(entry.state) &&
    !isInRun({ entry }) &&
    !isFixing({ entry });
  const primary = entries.find((entry) => entry.threadId === threadId) ?? null;
  if (primary === null) {
    return { blocked: null, picked: [], candidates: [] };
  }
  const blocked = isInRun({ entry: primary })
    ? COMMENT_RUN_COPY.inRun
    : isFixing({ entry: primary })
      ? COMMENT_RUN_COPY.fixing
      : null;
  const extras = [...new Set(extraThreadIds)].flatMap((id) => {
    const entry = entries.find((candidate) => candidate.threadId === id);
    return entry !== undefined && isJoinable({ entry }) ? [entry] : [];
  });
  const picked = [primary, ...extras];
  const pickedIds = new Set(picked.map((entry) => entry.threadId));
  const path = pathOf({ entry: primary });
  const folder = folderOf({ path });
  const candidates =
    folder === null
      ? []
      : entries
          .filter(
            (entry) =>
              !pickedIds.has(entry.threadId) &&
              isJoinable({ entry }) &&
              folderOf({ path: pathOf({ entry }) }) === folder,
          )
          .sort(
            (a, b) => Number(pathOf({ entry: b }) === path) - Number(pathOf({ entry: a }) === path),
          )
          .slice(0, MAX_CANDIDATES);
  return { blocked, picked, candidates };
};
