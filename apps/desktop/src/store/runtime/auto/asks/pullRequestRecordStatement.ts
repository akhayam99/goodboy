import type { ResultPullRequest } from '@goodboy/core/auto';
import type { AutoDelegation, GuardedStatement } from '@goodboy/db';

const ABORT_RECORD = 'pull_request_record';

type Params = {
  readonly delegation: AutoDelegation;
  readonly record: ResultPullRequest;
  readonly fromState: ResultPullRequest['state'];
  readonly staleBefore?: number;
};

export const pullRequestRecordStatement = ({
  delegation,
  record,
  fromState,
  staleBefore,
}: Params): GuardedStatement => ({
  sql: `UPDATE auto_delegations
    SET result_json = json_set(result_json, '$.verified.pullRequest', json(?))
    WHERE id = ? AND generation = ? AND state = 'settled'
      AND json_extract(result_json, '$.verified.pullRequest.textVersion') = ?
      AND json_extract(result_json, '$.verified.pullRequest.state') = ?${
        staleBefore === undefined
          ? ''
          : " AND coalesce(json_extract(result_json, '$.verified.pullRequest.startedAt'), 0) < ?"
      }`,
  params: [
    JSON.stringify(record),
    delegation.id,
    delegation.generation,
    record.textVersion,
    fromState,
    ...(staleBefore === undefined ? [] : [staleBefore]),
  ],
  abortWhen: 'noChanges',
  abortCode: ABORT_RECORD,
});
