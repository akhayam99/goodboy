import { checksRunOfResult, publishOfResult } from '@goodboy/core/auto';
import { isRecord } from '@goodboy/types/helpers';
import type { AutoTreeView } from './state';

type Params = {
  readonly first: ReadonlyArray<AutoTreeView>;
  readonly second: ReadonlyArray<AutoTreeView>;
};

type ResultParams = {
  readonly result: unknown;
};

const verifiedChecksOf = ({ result }: ResultParams): unknown =>
  isRecord(result) && isRecord(result['verified']) ? (result['verified']['checks'] ?? null) : null;

const signatureOf = (view: AutoTreeView): string =>
  JSON.stringify([
    view.tree,
    view.delegations.map((delegation) => [
      delegation.id,
      delegation.state,
      delegation.outcome,
      delegation.settledAt,
      delegation.isStopping,
      delegation.questionCycles,
      publishOfResult({ result: delegation.result }),
      checksRunOfResult({ result: delegation.result }),
      verifiedChecksOf({ result: delegation.result }),
    ]),
    view.hiddenChildIds,
    view.artifacts.map((row) => [
      row.artifact.artifactId,
      row.artifact.rev,
      row.revision,
      row.status,
    ]),
    view.budget,
    view.pendingRefusal,
    view.pendingMessages,
    view.readMessages ?? [],
    view.droppedMessageIds,
    view.deliveredResults.map((result) => [
      result.runId,
      result.delegationId,
      result.outcome,
      result.outcomeLine,
    ]),
    view.rootAsk,
    (view.grantAsks ?? []).map((grant) => [grant.id, grant.state, grant.isCurrent]),
    Object.keys(view.launchSnapshots ?? {}),
  ]);

export const sameAutoTreeViews = ({ first, second }: Params): boolean =>
  first.length === second.length &&
  first.every((view, index) => {
    const other = second[index];
    return other !== undefined && signatureOf(view) === signatureOf(other);
  });
