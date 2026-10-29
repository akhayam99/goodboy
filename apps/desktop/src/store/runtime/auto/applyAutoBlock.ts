import {
  describeAutoRefusal,
  parseAutoBlock,
  parseDelegateSpec,
  parseProposeSpec,
  type AutoBlock,
  type AutoRefusalCode,
  type RefusalPayload,
} from '@goodboy/core';
import { getAutoTree, insertAutoOutbox, type AutoTree } from '@goodboy/db';
import { brandId, type AutoOutboxId, type AutoRequestId } from '@goodboy/types';
import { replayAdmission } from './admit';
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

const SILENT_CODES: ReadonlyArray<string> = ['tree_stopped', 'generation_changed'];
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
    case 'propose':
      return {
        verb: block.action,
        args: { 'request-id': block.requestId ?? `auto-${grant.runId}`, spec: block.spec },
        grant,
      };
    case 'answer':
      return {
        verb: 'answer',
        args: {
          delegation: block.delegation,
          question: block.question,
          text: block.text,
          ...(block.artifact === null ? {} : { artifact: block.artifact }),
        },
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

type RolesParams = {
  readonly block: AutoBlock;
};

const rolesOf = ({ block }: RolesParams): ReadonlyArray<string> => {
  if (block.action !== 'delegate' && block.action !== 'propose') {
    return [];
  }
  const spec =
    block.action === 'propose'
      ? parseProposeSpec({ text: block.spec })
      : parseDelegateSpec({ text: block.spec });
  if (spec.kind !== 'ok') {
    return [];
  }
  return spec.children.flatMap((child) => (child.role === null ? [] : [child.role]));
};

type WriteRefusalParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly runId: string;
  readonly action: string;
  readonly code: string;
  readonly text: string;
  readonly roles: ReadonlyArray<string>;
};

const writeRefusal = async ({
  ctx,
  tree,
  runId,
  action,
  code,
  text,
  roles,
}: WriteRefusalParams): Promise<void> => {
  const payload: RefusalPayload = { kind: 'refusal', runId, action, code, text, roles };
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

type RunBlockParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly ended: AutoTurnEnded;
  readonly block: AutoBlock;
};

const runBlock = async ({
  ctx,
  tree,
  ended,
  block,
}: RunBlockParams): Promise<ApplyAutoBlockOutcome> => {
  const command = commandOf({
    block,
    grant: {
      agentId: ended.agentId,
      treeId: tree.id,
      generation: ended.generation,
      workspaceId: await workspaceOf({ ctx, tree }),
      sessionId: tree.sessionId,
      runId: ended.runId,
    },
  });
  const outcome = await runAutoCommand({ ctx, command });
  if (outcome.isOk) {
    return { kind: 'applied', action: block.action };
  }
  const code = outcome.code ?? INVALID_BLOCK_CODE;
  if (SILENT_CODES.includes(code)) {
    return { kind: 'skipped', reason: 'stale' };
  }
  await writeRefusal({
    ctx,
    tree,
    runId: ended.runId,
    action: block.action,
    code,
    text: outcome.error ?? describeAutoRefusal({ code: INVALID_BLOCK_CODE }),
    roles: rolesOf({ block }),
  });
  return { kind: 'refused', action: block.action, code };
};

type PastTurnParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree | null;
  readonly ended: AutoTurnEnded;
};

const NOT_CURRENT: ApplyAutoBlockOutcome = { kind: 'skipped', reason: 'not_current' };

const answerPastTurn = async ({
  ctx,
  tree,
  ended,
}: PastTurnParams): Promise<ApplyAutoBlockOutcome> => {
  if (tree === null || tree.generation !== ended.generation || tree.stopState !== 'none') {
    return NOT_CURRENT;
  }
  const parsed = parseAutoBlock({ text: ended.assistantText });
  if (
    parsed.kind !== 'block' ||
    (parsed.block.action !== 'delegate' && parsed.block.action !== 'propose')
  ) {
    return NOT_CURRENT;
  }
  const spec =
    parsed.block.action === 'propose'
      ? parseProposeSpec({ text: parsed.block.spec })
      : parseDelegateSpec({ text: parsed.block.spec });
  const replay =
    spec.kind === 'ok'
      ? await replayAdmission({
          db: ctx.db,
          treeId: tree.id,
          requestId: brandId<AutoRequestId>({
            value: parsed.block.requestId ?? `auto-${ended.runId}`,
          }),
          requestHash: spec.hash,
        })
      : null;
  if (replay !== null && replay.kind === 'replayed') {
    return { kind: 'applied', action: parsed.block.action };
  }
  const code: AutoRefusalCode = 'not_deciding';
  await writeRefusal({
    ctx,
    tree,
    runId: ended.runId,
    action: parsed.block.action,
    code,
    text: describeAutoRefusal({ code }),
    roles: rolesOf({ block: parsed.block }),
  });
  return { kind: 'refused', action: parsed.block.action, code };
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
    return answerPastTurn({ ctx, tree, ended });
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
      roles: [],
    });
    return { kind: 'refused', action: 'block', code: INVALID_BLOCK_CODE };
  }
  return runBlock({ ctx, tree, ended, block: parsed.block });
};
