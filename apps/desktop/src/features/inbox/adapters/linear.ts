import { linearStateCategory } from '../../../shared/detail-fields/linearIssueFields';
import type { LinearIssueGroup } from '../../integrations/linear/LinearStudio/useLinearIssues';
import type { InboxRecord } from '../types';

type Params = { readonly groups: ReadonlyArray<LinearIssueGroup> };
export const adaptLinearIssues = ({ groups }: Params): InboxRecord[] =>
  groups.flatMap((group) =>
    group.rows.map(({ issue, sessionId }) => ({
      key: `linear:issue:${issue.id}`,
      provider: 'linear',
      kind: 'issue',
      identifier: issue.identifier,
      title: issue.title,
      state: linearStateCategory({ type: issue.state.type }),
      stateLabel: issue.state.name,
      updatedAt: issue.updatedAt,
      url: issue.url,
      context: issue.project?.name ?? issue.team.key,
      payload: { provider: 'linear', kind: 'issue', issue, sessionId },
    })),
  );
