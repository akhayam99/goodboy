import type {
  PrComment,
  ResolveThread,
  ResolveThreadGitState,
  ResolveVerdict,
} from '@goodboy/types';
import type { FixLocation, FixOnOrigin, OriginCommit } from '../../../features/worktree/worktree';
import { groupThreads } from '../../../features/github/comment-threads';
import { userReplyIn } from './userReplyIn';

export type ThreadRemoteKind = 'on_origin' | 'looks_fixed' | 'you_replied' | 'missing' | 'folded';

export type ThreadElsewhereFix = Readonly<{
  sha: string;
  author: string | null;
  handle: string | null;
  subject: string | null;
  committedAt: number | null;
  path: string | null;
  line: number | null;
  origin: 'commit' | 'cherry';
}>;

export type ThreadGitFacts = Readonly<{
  gitState: ResolveThreadGitState;
  onOrigin: Readonly<{ sha: string; branch: string }> | null;
  elsewhere: ThreadElsewhereFix | null;
  missing: Readonly<{ sha: string; wasPushed: boolean; isPathGone: boolean }> | null;
  folded: Readonly<{ sha: string; landedAs: string }> | null;
  userReply: Readonly<{ commentId: string; createdAtMs: number }> | null;
  verdict: ResolveVerdict | null;
}>;

export type ThreadGitPorts = {
  readonly fixOnOrigin: (params: { readonly sha: string }) => Promise<FixOnOrigin>;
  readonly isOnLocalHead: (params: { readonly sha: string }) => Promise<boolean>;
  readonly locateFix: (params: {
    readonly sha: string;
    readonly path: string | null;
  }) => Promise<FixLocation>;
  readonly commitsTouching: (params: {
    readonly path: string;
    readonly line: number;
    readonly sinceSecs: number;
  }) => Promise<ReadonlyArray<OriginCommit>>;
};

type Params = {
  readonly row: ResolveThread;
  readonly comments: ReadonlyArray<PrComment>;
  readonly viewerLogins: ReadonlySet<string>;
  readonly ownShas: ReadonlySet<string>;
  readonly branch: string;
  readonly ports: ThreadGitPorts;
  readonly isDismissed: (params: { readonly sha: string }) => boolean;
};

const PROBED_STAGES: ReadonlySet<ResolveThread['stage']> = new Set([
  'new',
  'asking',
  'proposed',
  'failed',
  'parked',
]);

const LOCAL: ThreadGitFacts = {
  gitState: 'local',
  onOrigin: null,
  elsewhere: null,
  missing: null,
  folded: null,
  userReply: null,
  verdict: null,
};

export const isWatchedThread = ({ row }: { readonly row: ResolveThread }): boolean =>
  row.state !== 'closed' &&
  row.state !== 'working' &&
  row.state !== 'publishing' &&
  row.replyPostedAt === null &&
  row.githubResolved !== true;

export const isPushedThread = ({ row }: { readonly row: ResolveThread }): boolean =>
  row.state !== 'closed' &&
  row.replyPostedAt !== null &&
  row.githubResolved !== true &&
  row.disposition === 'fix' &&
  (row.commitShas ?? []).length > 0;

export const handleOf = ({ email }: { readonly email: string }): string | null => {
  const local = email.split('@')[0] ?? '';
  const login = local.includes('+') ? (local.split('+').at(-1) ?? '') : local;
  return login === '' ? null : login;
};

const secondsOf = ({ iso }: { readonly iso: string }): number =>
  Math.floor(new Date(iso).getTime() / 1000);

const firstOf = <T>(items: ReadonlyArray<T>): T | null => items[0] ?? null;

const fixedByCommit = ({
  commit,
  path,
  line,
}: {
  readonly commit: OriginCommit;
  readonly path: string;
  readonly line: number;
}): ThreadElsewhereFix => ({
  sha: commit.sha,
  author: commit.author,
  handle: handleOf({ email: commit.email }),
  subject: commit.subject,
  committedAt: commit.committedAt * 1000,
  path,
  line,
  origin: 'commit',
});

const probeFix = async ({
  row,
  branch,
  path,
  ports,
  isDismissed,
}: Pick<Params, 'row' | 'branch' | 'ports' | 'isDismissed'> & {
  readonly path: string | null;
}): Promise<ThreadGitFacts | null> => {
  const shas = row.disposition === 'fix' ? (row.commitShas ?? []) : [];
  if (shas.length === 0) {
    return null;
  }
  const seen = await Promise.all(
    shas.map((sha) => ports.fixOnOrigin({ sha }).catch(() => null as FixOnOrigin | null)),
  );
  if (seen.every((item) => item?.onOrigin === true)) {
    return {
      ...LOCAL,
      gitState: 'on_origin',
      onOrigin: { sha: shas.at(-1) ?? '', branch },
    };
  }
  const landed = seen.flatMap((item, index) =>
    item?.onOrigin === true ? [] : item?.landedAs == null ? [] : [{ sha: item.landedAs, index }],
  );
  const isEachPlaced = seen.every((item) => item?.onOrigin === true || item?.landedAs != null);
  const first = firstOf(landed);
  if (isEachPlaced && first !== null) {
    if (isDismissed({ sha: first.sha })) {
      return LOCAL;
    }
    return {
      ...LOCAL,
      gitState: 'fixed_elsewhere',
      elsewhere: {
        sha: first.sha,
        author: null,
        handle: null,
        subject: null,
        committedAt: null,
        path: null,
        line: null,
        origin: 'cherry',
      },
    };
  }
  const pending = shas.filter((sha, index) => seen[index]?.onOrigin !== true);
  const reachable = await Promise.all(
    pending.map((sha) => ports.isOnLocalHead({ sha }).catch(() => true)),
  );
  const lost = pending.filter((sha, index) => reachable[index] === false);
  if (lost.length === 0) {
    return null;
  }
  const located = await Promise.all(
    lost.map((sha) => ports.locateFix({ sha, path }).catch(() => null as FixLocation | null)),
  );
  const firstLost = lost[0] ?? '';
  const placed = located.flatMap((item) => (item?.landedAs == null ? [] : [item.landedAs]));
  if (placed.length === lost.length) {
    return {
      ...LOCAL,
      gitState: 'folded',
      folded: { sha: firstLost, landedAs: placed.at(-1) ?? '' },
    };
  }
  const unplaced = lost.findIndex((sha, index) => located[index]?.landedAs == null);
  return {
    ...LOCAL,
    gitState: 'missing',
    missing: {
      sha: lost[unplaced] ?? firstLost,
      wasPushed: false,
      isPathGone: located[unplaced]?.pathExists === false,
    },
  };
};

const probePushed = async ({
  row,
  ports,
}: Pick<Params, 'row' | 'ports'>): Promise<ThreadGitFacts | null> => {
  const shas = row.commitShas ?? [];
  const seen = await Promise.all(
    shas.map((sha) => ports.fixOnOrigin({ sha }).catch(() => null as FixOnOrigin | null)),
  );
  const gone = shas.findIndex((sha, index) => {
    const item = seen[index];
    return item !== null && item !== undefined && !item.onOrigin && item.landedAs === null;
  });
  const first = shas[gone];
  return gone === -1 || first === undefined
    ? null
    : {
        ...LOCAL,
        gitState: 'missing',
        missing: { sha: first, wasPushed: true, isPathGone: false },
      };
};

const headOf = ({
  comments,
  threadId,
}: {
  readonly comments: ReadonlyArray<PrComment>;
  readonly threadId: string;
}): PrComment | null =>
  groupThreads(comments.filter((comment) => comment.threadId === threadId))[0]?.head ?? null;

const probeElsewhere = async ({
  row,
  comments,
  ownShas,
  ports,
  isDismissed,
}: Pick<
  Params,
  'row' | 'comments' | 'ownShas' | 'ports' | 'isDismissed'
>): Promise<ThreadGitFacts | null> => {
  if (!PROBED_STAGES.has(row.stage) || (row.commitShas ?? []).length > 0) {
    return null;
  }
  const head = headOf({ comments, threadId: row.threadId });
  if (head === null || head.path === undefined || head.line === undefined) {
    return null;
  }
  const commits = await ports
    .commitsTouching({
      path: head.path,
      line: head.line,
      sinceSecs: secondsOf({ iso: head.createdAt }),
    })
    .catch(() => []);
  const found = commits.find(
    (commit) => !ownShas.has(commit.sha) && !isDismissed({ sha: commit.sha }),
  );
  if (found === undefined) {
    return null;
  }
  return {
    ...LOCAL,
    gitState: 'fixed_elsewhere',
    elsewhere: fixedByCommit({ commit: found, path: head.path, line: head.line }),
  };
};

export const computeThreadGitFacts = async ({
  row,
  comments,
  viewerLogins,
  ownShas,
  branch,
  ports,
  isDismissed,
}: Params): Promise<ThreadGitFacts> => {
  if (isPushedThread({ row })) {
    return (await probePushed({ row, ports })) ?? LOCAL;
  }
  if (!isWatchedThread({ row })) {
    return LOCAL;
  }
  const head = headOf({ comments, threadId: row.threadId });
  const reply = userReplyIn({
    comments,
    threadId: row.threadId,
    viewerLogins,
    afterMs: row.createdAt,
    ownReplyId: row.replyId,
  });
  const userReply =
    reply === null
      ? null
      : { commentId: reply.id, createdAtMs: new Date(reply.createdAt).getTime() };
  const probed =
    (await probeFix({ row, branch, path: head?.path ?? null, ports, isDismissed })) ??
    (await probeElsewhere({ row, comments, ownShas, ports, isDismissed })) ??
    LOCAL;
  return { ...probed, userReply };
};

export const remoteKindOf = ({
  facts,
}: {
  readonly facts: ThreadGitFacts | null | undefined;
}): ThreadRemoteKind | null => {
  if (facts === null || facts === undefined) {
    return null;
  }
  if (facts.userReply !== null) {
    return 'you_replied';
  }
  switch (facts.gitState) {
    case 'on_origin':
      return 'on_origin';
    case 'fixed_elsewhere':
      return 'looks_fixed';
    case 'missing':
      return 'missing';
    case 'folded':
      return 'folded';
    case 'local':
      return null;
    default: {
      const exhaustive: never = facts.gitState;
      return exhaustive;
    }
  }
};

export const handledByLine = ({ fix }: { readonly fix: ThreadElsewhereFix }): string => {
  const short = fix.sha.slice(0, 7);
  return fix.handle === null ? `Handled in ${short}.` : `Handled in ${short} by @${fix.handle}.`;
};
