import type { LinearIssueGroup } from '../../integrations/linear/LinearStudio/useLinearIssues';
import type { InboxRecord, InboxState } from '../types';

type Params = { readonly groups: ReadonlyArray<LinearIssueGroup> };
type StateParams = { readonly value: string };
const normalize = ({ value }: StateParams): InboxState =>
  value === 'completed' || value === 'canceled' ? 'done' : value === 'started' ? 'active' : 'open';
export const adaptLinearIssues = ({ groups }: Params): InboxRecord[] =>
  groups.flatMap((group) =>
    group.rows.map(({ issue, sessionId }) => ({
      key: `linear:issue:${issue.id}`,
      provider: 'linear',
      kind: 'issue',
      identifier: issue.identifier,
      title: issue.title,
      state: normalize({ value: issue.state.type }),
      updatedAt: issue.updatedAt,
      url: issue.url,
      meta: issue.project?.name ?? issue.team.key,
      payload: { provider: 'linear', kind: 'issue', issue, sessionId },
    })),
  );
