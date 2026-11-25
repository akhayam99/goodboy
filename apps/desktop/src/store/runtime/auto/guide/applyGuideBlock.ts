import {
  describeAutoRefusal,
  deviatedGuide,
  followedGuide,
  heldGuide,
  type AutoBlock,
  type AutoRefusalCode,
} from '@goodboy/core/auto';
import type { AutoTree } from '@goodboy/db';
import { changeRunGuide } from '../../runGuide/changeRunGuide';
import { ensureRunGuide } from '../../runGuide/ensureRunGuide';
import { writeRefusal } from '../mount/writeRefusal';
import type { AutoTurnEnded } from '../ports';
import type { AgentVerbContext } from '../verbContext';

export type GuideBlock = Extract<AutoBlock, { action: 'follow' | 'hold' | 'deviate' }>;

export type GuideBlockOutcome =
  | Readonly<{ kind: 'applied' }>
  | Readonly<{ kind: 'stale' }>
  | Readonly<{ kind: 'refused'; code: AutoRefusalCode }>;

type Params = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly ended: AutoTurnEnded;
  readonly block: GuideBlock;
  readonly joinSuffix?: string;
};

type RefuseParams = {
  readonly code: AutoRefusalCode;
  readonly message?: string;
};

const NO_WORKFLOW_TEXT =
  'This run follows no workflow, so there is nothing to report. Go on without that block.';

export const applyGuideBlock = async ({
  ctx,
  tree,
  ended,
  block,
  joinSuffix = block.action,
}: Params): Promise<GuideBlockOutcome> => {
  const refuse = async ({ code, message }: RefuseParams): Promise<GuideBlockOutcome> => {
    await writeRefusal({
      ctx,
      tree,
      runId: ended.runId,
      action: block.action,
      code,
      text: describeAutoRefusal({ code, ...(message === undefined ? {} : { message }) }),
      roles: [],
      joinKey: `refusal:${ended.runId}:${joinSuffix}`,
    });
    return { kind: 'refused', code };
  };
  const guide = await ensureRunGuide({ db: ctx.db, treeId: tree.id });
  if (guide === null) {
    return refuse({ code: 'spec_invalid', message: NO_WORKFLOW_TEXT });
  }
  if (guide.check === 'held') {
    return refuse({ code: 'held' });
  }
  const changed = await changeRunGuide({
    db: ctx.db,
    treeId: tree.id,
    turn: { generation: ended.generation, runId: ended.runId },
    change: ({ guide: current }) => {
      if (block.action === 'follow') {
        return followedGuide({ guide: current, note: block.check });
      }
      if (block.action === 'hold') {
        return heldGuide({ guide: current, reason: block.reason, suggest: block.suggest });
      }
      return deviatedGuide({
        guide: current,
        deviation: { change: block.change, step: block.step, reason: block.reason },
      });
    },
  });
  return changed.kind === 'stale' ? { kind: 'stale' } : { kind: 'applied' };
};
