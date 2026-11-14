import { publishOfResult, pullRequestOfResult, type LeadPermissionKey } from '@goodboy/core/auto';
import type { AutoDelegation } from '@goodboy/db';
import { leadAsksOf, type LeadAsk } from '../../../store/runtime/auto/asks/leadAsksOf';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';

export type AskBarKind = 'push' | 'pull_request' | 'dependency' | 'protected_file';

export type AskBar = Readonly<{
  askId: string;
  kind: AskBarKind;
  title: string;
  code: string | null;
  detail: string;
  allowLabel: string;
  declineLabel: string;
  rowKey: LeadPermissionKey;
}>;

export type AskBars = Readonly<{
  first: AskBar | null;
  moreCount: number;
}>;

type Params = {
  readonly view: AutoTreeView;
};

type AskParams = {
  readonly ask: LeadAsk;
  readonly delegation: AutoDelegation | null;
};

type RoleParams = {
  readonly delegation: AutoDelegation | null;
};

const SHORT_SHA_LENGTH = 7;

const roleWordOf = ({ delegation }: RoleParams): string => {
  const role = delegation?.role ?? 'agent';
  return `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
};

const pushBarOf = ({ ask, delegation }: AskParams): AskBar => {
  const publish = delegation === null ? null : publishOfResult({ result: delegation.result });
  const isForce = publish?.mode === 'force';
  const branch = ask.subject === '' ? 'the branch' : ask.subject;
  const sha = publish?.sha ?? null;
  const commit = sha === null ? '' : `Commit ${sha.slice(0, SHORT_SHA_LENGTH)} · `;
  return {
    askId: ask.id,
    kind: 'push',
    title: isForce ? `Force push ${branch}?` : `Push ${branch}?`,
    code: null,
    detail: isForce
      ? `${commit}Each earlier version is kept as a backup.`
      : `${commit}Goodboy pushes, agents never do.`,
    allowLabel: isForce ? 'Force push' : 'Push',
    declineLabel: "Don't push",
    rowKey: 'push',
  };
};

const pullRequestBarOf = ({ ask, delegation }: AskParams): AskBar => {
  const pullRequest =
    delegation === null ? null : pullRequestOfResult({ result: delegation.result });
  const title = pullRequest?.title ?? null;
  return {
    askId: ask.id,
    kind: 'pull_request',
    title: 'Open the pull request?',
    code: null,
    detail:
      title === null
        ? 'A Scribe wrote it. Goodboy publishes it.'
        : `${title} · A Scribe wrote it. Goodboy publishes it.`,
    allowLabel: 'Open the pull request',
    declineLabel: 'Not yet',
    rowKey: 'pullRequest',
  };
};

const grantBarOf = ({ ask, delegation }: AskParams): AskBar => {
  const isDependency = ask.kind === 'dependency';
  return {
    askId: ask.id,
    kind: isDependency ? 'dependency' : 'protected_file',
    title: `${roleWordOf({ delegation })} needs ${isDependency ? 'a dependency' : 'a protected file'}`,
    code: ask.subject,
    detail: isDependency
      ? 'It stopped before installing: nothing was downloaded, no file changed.'
      : 'It stopped before changing it: no file was changed.',
    allowLabel: `Allow ${ask.subject}`,
    declineLabel: 'Do it without',
    rowKey: isDependency ? 'dependencies' : 'protectedFiles',
  };
};

const barOf = ({ ask, delegation }: AskParams): AskBar | null => {
  switch (ask.kind) {
    case 'start':
      return null;
    case 'push':
      return pushBarOf({ ask, delegation });
    case 'pull_request':
      return pullRequestBarOf({ ask, delegation });
    case 'dependency':
    case 'protected_file':
      return grantBarOf({ ask, delegation });
    default: {
      const unreachable: never = ask.kind;
      return unreachable;
    }
  }
};

export const askBarsOf = ({ view }: Params): AskBars => {
  const bars = leadAsksOf({ view }).flatMap((ask): ReadonlyArray<AskBar> => {
    const delegation =
      view.delegations.find((candidate) => candidate.id === ask.delegationId) ?? null;
    const bar = barOf({ ask, delegation });
    return bar === null ? [] : [bar];
  });
  return { first: bars[0] ?? null, moreCount: Math.max(0, bars.length - 1) };
};
