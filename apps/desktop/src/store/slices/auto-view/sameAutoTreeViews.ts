import type { AutoTreeView } from './state';

type Params = {
  readonly first: ReadonlyArray<AutoTreeView>;
  readonly second: ReadonlyArray<AutoTreeView>;
};

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
    view.deliveredResults.map((result) => [
      result.runId,
      result.delegationId,
      result.outcome,
      result.outcomeLine,
    ]),
    view.rootAsk,
  ]);

export const sameAutoTreeViews = ({ first, second }: Params): boolean =>
  first.length === second.length &&
  first.every((view, index) => {
    const other = second[index];
    return other !== undefined && signatureOf(view) === signatureOf(other);
  });
