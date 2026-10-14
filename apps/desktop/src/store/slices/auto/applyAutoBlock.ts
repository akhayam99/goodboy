import {
  describeAutoRefusal,
  parseAutoBlock,
  type AutoBlock,
  type AutoRefusalCode,
  type RefusalPayload,
} from '@goodboy/core';
import { getAutoTree, insertAutoOutbox, type AutoTree } from '@goodboy/db';
import { brandId, type AutoOutboxId } from '@goodboy/types';
import type { AgentCommand, AutoTurnEnded } from './ports';
import { runAutoCommand } from './runAutoCommand';
import type { AgentVerbContext } from './verbContext';

export type ApplyAutoBlockParams = Readonly<{
  ctx: AgentVerbContext;
  ended: AutoTurnEnded;
}>;

export type ApplyAutoBlockOutcome =
  | Readonly<{ kind: 'skipped'; reason: 'not_ok' | 'not_current' | 'no_block' | 'stale' }>
  | Readonly<{ kind: 'applied'; action: AutoBlock['action'] }>
  | Readonly<{ kind: 'refused'; action: string; code: string }>;

const STALE_CODES: ReadonlyArray<string> = ['tree_stopped', 'generation_changed', 'not_deciding'];
const INVALID_BLOCK_CODE: AutoRefusalCode = 'spec_invalid';

type GrantParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly ended: AutoTurnEnded;
};

const workspaceOf = async ({ ctx, tree }: Pick<GrantParams, 'ctx' | 'tree'>): Promise<string> => {
  const rows = await ctx.db.select<{ readonly workspace_id: string }>(
    'SELECT workspace_id FROM sessions WHERE id = ?',
    [tree.sessionId],
  );
  return rows[0]?.workspace_id ?? '';
};

type CommandParams = {
  readonly block: AutoBlock;
  readonly grant: AgentCommand['grant'];
};

const commandOf = ({ block, grant }: CommandParams): AgentCommand => {
  switch (block.action) {
    case 'delegate':
      return {
        verb: 'delegate',
        args: { 'request-id': block.requestId ?? `auto-${grant.runId}`, spec: block.spec },
        grant,
      };
    case 'answer':
      return {
        verb: 'answer',
        args: { delegation: block.delegation, question: block.question, text: block.text },
        grant,
      };
    case 'finish':
      return { verb: 'finish', args: { summary: block.summary }, grant };
    default: {
      const unreachable: never = block;
      return unreachable;
    }
  }
};

type WriteRefusalParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly runId: string;
  readonly action: string;
  readonly code: string;
  readonly text: string;
};

const writeRefusal = async ({
  ctx,
  tree,
  runId,
  action,
  code,
  text,
}: WriteRefusalParams): Promise<void> => {
  const payload: RefusalPayload = { kind: 'refusal', runId, action, code, text };
  await insertAutoOutbox({
    db: ctx.db,
    outbox: {
      id: brandId<AutoOutboxId>({ value: ctx.ports.newId() }),
      treeId: tree.id,
      generation: tree.generation,
      kind: 'refusal',
      joinKey: `refusal:${runId}`,
      payload,
      nowMs: ctx.now(),
    },
  });
};

export const applyAutoBlock = async ({
  ctx,
  ended,
}: ApplyAutoBlockParams): Promise<ApplyAutoBlockOutcome> => {
  if (ended.exit !== 'ok') {
    return { kind: 'skipped', reason: 'not_ok' };
  }
  const tree = await getAutoTree({ db: ctx.db, treeId: ended.treeId });
  const isCurrent =
    tree !== null &&
    tree.generation === ended.generation &&
    tree.activeRunId === ended.runId &&
    tree.phase === 'deciding' &&
    tree.stopState === 'none';
  if (!isCurrent) {
    return { kind: 'skipped', reason: 'not_current' };
  }
  const parsed = parseAutoBlock({ text: ended.assistantText });
  if (parsed.kind === 'none') {
    return { kind: 'skipped', reason: 'no_block' };
  }
  if (parsed.kind === 'invalid') {
    const text = describeAutoRefusal({ code: INVALID_BLOCK_CODE, message: parsed.reason });
    await writeRefusal({
      ctx,
      tree,
      runId: ended.runId,
      action: 'block',
      code: INVALID_BLOCK_CODE,
      text,
    });
    return { kind: 'refused', action: 'block', code: INVALID_BLOCK_CODE };
  }
  const command = commandOf({
    block: parsed.block,
    grant: {
      agentId: ended.agentId,
      treeId: tree.id,
      generation: tree.generation,
      workspaceId: await workspaceOf({ ctx, tree }),
      sessionId: tree.sessionId,
      runId: ended.runId,
    },
  });
  const outcome = await runAutoCommand({ ctx, command });
  if (outcome.isOk) {
    return { kind: 'applied', action: parsed.block.action };
  }
  const code = outcome.code ?? INVALID_BLOCK_CODE;
  if (STALE_CODES.includes(code)) {
    return { kind: 'skipped', reason: 'stale' };
  }
  await writeRefusal({
    ctx,
    tree,
    runId: ended.runId,
    action: parsed.block.action,
    code,
    text: outcome.error ?? describeAutoRefusal({ code: INVALID_BLOCK_CODE }),
  });
  return { kind: 'refused', action: parsed.block.action, code };
};
