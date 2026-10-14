import {
  buildArtifactBodiesBlock,
  buildArtifactLedgerBlock,
  buildDeliveryText,
  buildStateDigest,
  isResultsPayload,
  type DeliveryArtifactBody,
  type DigestDelegation,
} from '@goodboy/core';
import {
  listAutoArtifactLedger,
  listAutoAttemptsOfDelegation,
  listAutoDelegations,
  type AutoDelegation,
  type AutoOutboxRow,
  type AutoTree,
  type Database,
} from '@goodboy/db';
import { treeArtifacts } from './treeArtifacts';
import { treeBudget } from './treeBudget';

export type BuildDeliveryMessageParams = Readonly<{
  db: Database;
  tree: AutoTree;
  rows: ReadonlyArray<AutoOutboxRow>;
  nowMs: number;
}>;

type RestartMarkParams = {
  readonly payload: unknown;
};

const isRestartPayload = ({ payload }: RestartMarkParams): boolean =>
  typeof payload === 'object' &&
  payload !== null &&
  'restartOf' in payload &&
  typeof payload.restartOf === 'string';

type DigestParams = {
  readonly db: Database;
  readonly delegations: ReadonlyArray<AutoDelegation>;
  readonly nowMs: number;
};

type QuestionParams = {
  readonly snapshot: unknown;
};

const questionTextOf = ({ snapshot }: QuestionParams): string => {
  if (typeof snapshot !== 'object' || snapshot === null || !('question' in snapshot)) {
    return '';
  }
  return typeof snapshot.question === 'string' ? snapshot.question : '';
};

const digestDelegations = async ({
  db,
  delegations,
}: DigestParams): Promise<ReadonlyArray<DigestDelegation>> =>
  Promise.all(
    delegations.map(async (delegation): Promise<DigestDelegation> => {
      const task = delegation.request['task'];
      const base = {
        id: delegation.id,
        role: delegation.role,
        state: delegation.state,
        outcome: delegation.outcome,
        task: typeof task === 'string' ? task : '',
        createdAt: delegation.createdAt,
      };
      if (delegation.state !== 'paused') {
        return { ...base, question: null };
      }
      const attempts = await listAutoAttemptsOfDelegation({ db, delegationId: delegation.id });
      const paused = [...attempts].reverse().find((attempt) => attempt.questionId !== null);
      if (paused === undefined || paused.questionId === null) {
        return { ...base, question: null };
      }
      return {
        ...base,
        question: {
          questionId: paused.questionId,
          text: questionTextOf({ snapshot: paused.resultSnapshot }),
        },
      };
    }),
  );

type ArtifactIdsParams = {
  readonly rows: ReadonlyArray<AutoOutboxRow>;
};

const resultArtifactIds = ({ rows }: ArtifactIdsParams): ReadonlyArray<string> => {
  const ids: string[] = [];
  for (const row of rows) {
    if (!isResultsPayload(row.payload)) {
      continue;
    }
    for (const result of row.payload.results) {
      for (const artifact of result.artifacts) {
        if (!ids.includes(artifact.id)) {
          ids.push(artifact.id);
        }
      }
    }
  }
  return ids;
};

type BodiesParams = {
  readonly db: Database;
  readonly tree: AutoTree;
  readonly rows: ReadonlyArray<AutoOutboxRow>;
};

const artifactBodies = async ({
  db,
  tree,
  rows,
}: BodiesParams): Promise<ReadonlyArray<DeliveryArtifactBody>> => {
  const wanted = resultArtifactIds({ rows });
  if (wanted.length === 0) {
    return [];
  }
  const ledger = await listAutoArtifactLedger({ db, treeId: tree.id });
  return wanted.flatMap((id): ReadonlyArray<DeliveryArtifactBody> => {
    const row = ledger.find((entry) => entry.artifact.artifactId === id);
    if (row === undefined) {
      return [];
    }
    return [
      {
        id,
        kind: row.artifact.kind,
        title: row.title,
        revision: row.revision,
        body: row.sourceText,
      },
    ];
  });
};

export const buildDeliveryMessage = async ({
  db,
  tree,
  rows,
  nowMs,
}: BuildDeliveryMessageParams): Promise<string> => {
  const entries = await treeArtifacts({ db, treeId: tree.id });
  const budget = await treeBudget({ db, treeId: tree.id });
  const delegations = await listAutoDelegations({ db, treeId: tree.id });
  const digest = await digestDelegations({ db, delegations, nowMs });
  const bodies = await artifactBodies({ db, tree, rows });
  return buildDeliveryText({
    ledgerBlock: buildArtifactLedgerBlock({ entries, nowMs, generation: tree.generation }),
    budgetLine: budget === null ? '' : budget.promptLine,
    digestBlock: buildStateDigest({ delegations: digest, nowMs }),
    artifactsBlock: buildArtifactBodiesBlock({ artifacts: bodies }),
    rows: rows.map((row) => ({ id: row.id, payload: row.payload })),
    isRestart: rows.some((row) => isRestartPayload({ payload: row.payload })),
  });
};
