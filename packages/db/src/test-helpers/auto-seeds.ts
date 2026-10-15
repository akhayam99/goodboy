import {
  brandId,
  type AgentId,
  type ArtifactId,
  type AutoTreeId,
  type SessionId,
} from '@goodboy/types';
import type { Database } from '../client';
import { insertArtifact } from '../queries/artifact';
import { insertAutoTree, type AutoTree } from '../queries/auto-trees';

export const AUTO_SEED_SESSION = brandId<SessionId>({ value: 'session-harborline' });
export const AUTO_SEED_ROOT = brandId<AgentId>({ value: 'agent-auto-root' });
export const AUTO_SEED_NOW = 1_700_000_000_000;
export const AUTO_SEED_DAY_MS = 24 * 60 * 60 * 1000;

type SeedAutoSessionParams = {
  readonly db: Database;
  readonly agentIds?: ReadonlyArray<string>;
};

export const seedAutoSession = async ({
  db,
  agentIds = [],
}: SeedAutoSessionParams): Promise<void> => {
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ['workspace-harborline', 'Harborline', 'harborline', AUTO_SEED_NOW, AUTO_SEED_NOW],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [
      AUTO_SEED_SESSION,
      'workspace-harborline',
      'ship ledger-core',
      'idle',
      AUTO_SEED_NOW,
      AUTO_SEED_NOW,
    ],
  );
  const all: ReadonlyArray<string> = [AUTO_SEED_ROOT, ...agentIds];
  for (const [ordinal, id] of all.entries()) {
    await db.execute(
      'INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?, ?, ?, ?, ?)',
      [id, AUTO_SEED_SESSION, ordinal, `agent ${id}`, 'pending'],
    );
  }
};

type SeedAutoTreeParams = {
  readonly db: Database;
  readonly id?: string;
  readonly capUsd?: number;
  readonly primaryMountId?: string | null;
};

export const seedAutoTree = async ({
  db,
  id = 'tree-1',
  capUsd = 5,
  primaryMountId = 'mount-ledger-core',
}: SeedAutoTreeParams): Promise<AutoTree> => {
  const outcome = await insertAutoTree({
    db,
    tree: {
      id: brandId<AutoTreeId>({ value: id }),
      rootAgentId: AUTO_SEED_ROOT,
      sessionId: AUTO_SEED_SESSION,
      primaryMountId,
      capUsd,
      nowMs: AUTO_SEED_NOW,
      hardDeadlineAt: AUTO_SEED_NOW + AUTO_SEED_DAY_MS,
    },
  });
  return outcome.tree;
};

type SeedPlanArtifactParams = {
  readonly db: Database;
  readonly id: string;
  readonly agentId: string;
  readonly title?: string;
  readonly sourceText?: string;
};

export const seedPlanArtifact = async ({
  db,
  id,
  agentId,
  title = 'Plan for notify-relay',
  sourceText = '# Plan\n\n- step one\n- step two\n',
}: SeedPlanArtifactParams): Promise<void> => {
  await insertArtifact({
    db,
    input: {
      id: brandId<ArtifactId>({ value: id }),
      sessionId: AUTO_SEED_SESSION,
      agentId: brandId<AgentId>({ value: agentId }),
      kind: 'plan',
      schemaVersion: 1,
      title,
      sourceFormat: 'markdown',
      sourceText,
      metadata: {},
    },
  });
};
