import {
  canPutBackPublish,
  canRerunChecks,
  canRetryPublish,
  checksRunOfResult,
  checksTextOf,
  publishOfResult,
  publishTextOf,
  type PublishState,
} from '@goodboy/core';
import { isJsonRecord, listField, numberField, recordField, textField } from './readJson';

type ResultCheckView = Readonly<{
  name: string;
  status: 'pass' | 'fail' | 'unknown';
  isClaimed: boolean;
}>;

type ResultArtifactView = Readonly<{
  artifactId: string;
  kind: string;
  title: string;
  revision: number | null;
}>;

type PublishView = Readonly<{
  text: string;
  state: PublishState;
  canRetry: boolean;
  canPutBack: boolean;
}>;

export type DelegationResultView = Readonly<{
  summary: string | null;
  changedFileCount: number;
  checks: ReadonlyArray<ResultCheckView>;
  artifacts: ReadonlyArray<ResultArtifactView>;
  questions: ReadonlyArray<string>;
  costUsd: number | null;
  isCostEstimated: boolean;
  reason: string | null;
  reasonText: string | null;
  remoteText: string | null;
  checksText: string | null;
  checksVerdict: 'green' | 'red' | 'not_checked' | null;
  canRerunChecks: boolean;
  publish: PublishView | null;
}>;

const REMOTE_MOVED_CARD = 'The branch changed online while this agent worked.';
const REMOTE_UNKNOWN_CARD = 'Could not check whether the branch changed online.';

const remoteTextOf = ({ value }: StatusParams): string | null => {
  if (value === 'moved') {
    return REMOTE_MOVED_CARD;
  }
  return value === 'unknown' ? REMOTE_UNKNOWN_CARD : null;
};

type StatusParams = {
  readonly value: string | null;
};

const checkStatusOf = ({ value }: StatusParams): ResultCheckView['status'] =>
  value === 'pass' || value === 'fail' ? value : 'unknown';

const checkOf = (value: unknown): ResultCheckView | null => {
  const name = textField({ source: value, key: 'name' });
  if (name === null) {
    return null;
  }
  return {
    name,
    status: checkStatusOf({ value: textField({ source: value, key: 'status' }) }),
    isClaimed: textField({ source: value, key: 'source' }) === 'child_claim',
  };
};

const artifactOf = (value: unknown): ResultArtifactView | null => {
  const artifactId = textField({ source: value, key: 'id' });
  const title = textField({ source: value, key: 'title' });
  if (artifactId === null || title === null) {
    return null;
  }
  return {
    artifactId,
    kind: textField({ source: value, key: 'kind' }) ?? 'artifact',
    title,
    revision: numberField({ source: value, key: 'revision' }),
  };
};

type MappedParams<Item> = {
  readonly items: ReadonlyArray<unknown>;
  readonly read: (value: unknown) => Item | null;
};

const mapped = <Item>({ items, read }: MappedParams<Item>): ReadonlyArray<Item> =>
  items.flatMap((item) => {
    const one = read(item);
    return one === null ? [] : [one];
  });

const REASON_TEXT: ReadonlyMap<string, string> = new Map([
  ['deadline_passed', 'It ran out of time.'],
  ['stopped', 'It was stopped.'],
  ['process_error', 'The agent ended with an error.'],
  ['no_closing_envelope', 'It ended without saying whether the work was done.'],
  ['artifact_persistence_failed', 'Its result could not be saved.'],
  ['declared_blocked', 'It reported that it is blocked.'],
  ['missing_tool', 'It had no shell to run the commands of the task.'],
  ['no_new_version', 'It did not write a new version.'],
  ['lost_structure', 'Its new version lost the structure of the plan.'],
  ['stale_base', 'The version it worked on is no longer the latest.'],
]);

type Params = {
  readonly result: unknown;
};

export const delegationResultOf = ({ result }: Params): DelegationResultView | null => {
  if (!isJsonRecord(result)) {
    return null;
  }
  const declared = recordField({ source: result, key: 'declared' });
  const verified = recordField({ source: result, key: 'verified' });
  const cost = recordField({ source: result, key: 'cost' });
  const reasonOf = textField({ source: result, key: 'reason' });
  const checks = mapped({ items: listField({ source: verified, key: 'checks' }), read: checkOf });
  const checksRun = checksRunOfResult({ result });
  const publish = publishOfResult({ result });
  return {
    publish:
      publish === null
        ? null
        : {
            text: publishTextOf({ publish }),
            state: publish.state,
            canRetry: canRetryPublish({ publish }),
            canPutBack: canPutBackPublish({ publish }),
          },
    checksText:
      checksRun === null
        ? null
        : checksTextOf({
            run: checksRun,
            checks: checks.map((check) => ({
              name: check.name,
              status: check.status,
              source: check.isClaimed ? 'child_claim' : 'harness',
            })),
          }),
    checksVerdict: checksRun?.verdict ?? null,
    canRerunChecks: checksRun !== null && canRerunChecks({ run: checksRun }),
    summary: textField({ source: declared, key: 'summary' }),
    changedFileCount: listField({ source: verified, key: 'changedFiles' }).length,
    checks,
    artifacts: mapped({ items: listField({ source: result, key: 'artifacts' }), read: artifactOf }),
    questions: mapped({
      items: listField({ source: result, key: 'openQuestions' }),
      read: (value) => textField({ source: value, key: 'text' }),
    }),
    costUsd: numberField({ source: cost, key: 'usd' }),
    isCostEstimated: textField({ source: cost, key: 'basis' }) !== 'reported',
    reason: reasonOf,
    reasonText: reasonOf === null ? null : (REASON_TEXT.get(reasonOf) ?? null),
    remoteText: remoteTextOf({
      value: textField({
        source: recordField({ source: verified, key: 'remote' }),
        key: 'status',
      }),
    }),
  };
};
