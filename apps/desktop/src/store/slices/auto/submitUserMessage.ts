import { EMPTY_USER_FACTS, isResultsPayload, type UserFacts } from '@goodboy/core';
import { getAutoTree, insertAutoOutboxStatement, listAutoOutbox, type AutoTree } from '@goodboy/db';
import { brandId, type AutoOutboxId } from '@goodboy/types';
import { treeArtifacts } from './treeArtifacts';
import type { AgentVerbContext } from './verbContext';

export type SubmitUserMessageParams = Readonly<{
  ctx: AgentVerbContext;
  treeId: AutoTree['id'];
  text: string;
  facts?: Partial<Pick<UserFacts, 'focusArtifactId' | 'attachedArtifacts' | 'explicitChange'>>;
}>;

export type SubmitUserMessageOutcome =
  Readonly<{ kind: 'queued'; rowId: string }> | Readonly<{ kind: 'lost' }>;

const MAX_ATTEMPTS = 3;
const ABORT_GENERATION = 'submit_generation';

type FactsParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly given: SubmitUserMessageParams['facts'];
};

const factsOf = async ({ ctx, tree, given }: FactsParams): Promise<UserFacts> => {
  const entries = await treeArtifacts({ db: ctx.db, treeId: tree.id });
  const live = entries.filter(
    (entry) => entry.status === 'active' && entry.openReviseDelegationId === null,
  );
  const results = (await listAutoOutbox({ db: ctx.db, treeId: tree.id })).filter(
    (row) => row.kind === 'results' && row.generation === tree.generation,
  );
  const last = results[results.length - 1]?.payload;
  const lastArtifactIds = isResultsPayload(last)
    ? last.results.flatMap((result) => result.artifacts.map((artifact) => artifact.id))
    : [];
  const focus = given?.focusArtifactId ?? null;
  const attached = given?.attachedArtifacts ?? [];
  const explicit = given?.explicitChange ?? null;
  const hasFact = focus !== null || attached.length > 0 || explicit !== null;
  return {
    ...EMPTY_USER_FACTS,
    focusArtifactId: focus,
    attachedArtifacts: attached,
    explicitChange: explicit,
    lastResultArtifactIds: lastArtifactIds,
    isAmbiguous: !hasFact && live.length > 1,
  };
};

export const submitUserMessage = async ({
  ctx,
  treeId,
  text,
  facts,
}: SubmitUserMessageParams): Promise<SubmitUserMessageOutcome> => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const tree = await getAutoTree({ db: ctx.db, treeId });
    if (tree === null) {
      return { kind: 'lost' };
    }
    const rowId = ctx.ports.newId();
    const outcome = await ctx.db.transaction({
      statements: [
        {
          sql: 'SELECT 1 FROM auto_trees WHERE id = ? AND generation = ?',
          params: [treeId, tree.generation],
          abortWhen: 'noRows',
          abortCode: ABORT_GENERATION,
        },
        insertAutoOutboxStatement({
          outbox: {
            id: brandId<AutoOutboxId>({ value: rowId }),
            treeId,
            generation: tree.generation,
            kind: 'user',
            joinKey: `user:${rowId}`,
            payload: {
              kind: 'user',
              text,
              facts: await factsOf({ ctx, tree, given: facts }),
            },
            nowMs: ctx.now(),
          },
        }),
      ],
    });
    if (outcome.status === 'committed') {
      return { kind: 'queued', rowId };
    }
  }
  return { kind: 'lost' };
};
