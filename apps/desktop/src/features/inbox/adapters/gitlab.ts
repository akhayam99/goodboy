import type { GitlabIssueGroup } from '../../integrations/gitlab/GitlabStudio/useGitlabIssues';
import type { GitlabMrGroup } from '../../integrations/gitlab/GitlabStudio/useGitlabMrs';
import type { InboxRecord, InboxState } from '../types';

type Params = {
  readonly issueGroups: ReadonlyArray<GitlabIssueGroup>;
  readonly mrGroups: ReadonlyArray<GitlabMrGroup>;
  readonly host: string | null;
};
type StateParams = { readonly state: string };
const normalize = ({ state }: StateParams): InboxState =>
  state === 'opened' || state === 'open'
    ? 'open'
    : state === 'merged' || state === 'closed'
      ? 'done'
      : 'active';

export const adaptGitlab = ({ issueGroups, mrGroups, host }: Params): InboxRecord[] => [
  ...issueGroups.flatMap((group) =>
    group.rows.map(({ issue, sessionId }) => ({
      key: `gitlab:issue:${issue.id}`,
      provider: 'gitlab' as const,
      kind: 'issue' as const,
      identifier: issue.references.full,
      title: issue.title,
      state: normalize({ state: issue.state }),
      updatedAt: issue.updatedAt,
      url: issue.webUrl,
      meta: group.label,
      payload: { provider: 'gitlab' as const, kind: 'issue' as const, issue, sessionId },
    })),
  ),
  ...mrGroups.flatMap((group) =>
    group.rows.map((mr) => ({
      key: `gitlab:mr:${mr.id}`,
      provider: 'gitlab' as const,
      kind: 'mr' as const,
      identifier: `!${mr.iid}`,
      title: mr.title,
      state: normalize({ state: mr.state }),
      updatedAt: mr.updatedAt,
      url: mr.webUrl,
      meta: group.label,
      payload: { provider: 'gitlab' as const, kind: 'mr' as const, mr, host },
    })),
  ),
];
