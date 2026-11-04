import type { AutoBlock, AutoLevel, MountNote } from '@goodboy/core/auto';
import type { AutoTree } from '@goodboy/db';
import { readAutoLevel } from './level/readAutoLevel';
import type { AutoTurnEnded, MountProjectOutcome, MountProjectParams } from './ports';
import type { AgentVerbContext } from './verbContext';
import { writeRefusal } from './writeRefusal';

const MODE_OF_LEVEL = {
  step: 'ask',
  plan: 'allowance',
  run: 'mount',
} satisfies Readonly<Record<AutoLevel, MountProjectParams['mode']>>;

type MountBlock = Extract<AutoBlock, { action: 'mount' }>;

type Params = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly ended: AutoTurnEnded;
  readonly block: MountBlock;
};

type OutcomeParams = {
  readonly block: MountBlock;
  readonly outcome: MountProjectOutcome;
};

type Written = Readonly<{
  code: string;
  text: string;
  mount?: MountNote;
}>;

type NoteParams = {
  readonly block: MountBlock;
  readonly state: MountNote['state'];
};

const noteOf = ({ block, state }: NoteParams): MountNote => ({
  project: block.project,
  branch: block.branch,
  reason: block.reason,
  state,
});

const writtenOf = ({ block, outcome }: OutcomeParams): Written => {
  if (outcome.kind === 'ask') {
    return {
      code: 'mount_missing',
      text: `Asked the user to mount ${block.project}. Wait for the answer, then go on with the request.`,
      mount: noteOf({ block, state: 'ask' }),
    };
  }
  if (outcome.kind === 'mounted') {
    const branch = outcome.branch === '' ? '' : ` on branch ${outcome.branch}`;
    return {
      code: 'mounted',
      text: `Mounted ${outcome.name}${branch}. The folder is ready.`,
      mount: noteOf({ block, state: 'done' }),
    };
  }
  if (outcome.kind === 'failed') {
    return {
      code: 'mount_missing',
      text: `Could not mount ${outcome.name}: ${outcome.error}. Asked the user to confirm the mount.`,
      mount: noteOf({ block, state: 'ask' }),
    };
  }
  if (outcome.kind === 'ambiguous') {
    return {
      code: 'mount_ambiguous',
      text: `More than one project is called ${block.project}. The user is asked which one.`,
    };
  }
  return {
    code: 'mount_missing',
    text: `No project called ${block.project} is in this workspace. The user is asked which folder to use.`,
  };
};

export const applyMountBlock = async ({ ctx, tree, ended, block }: Params): Promise<void> => {
  const level = await readAutoLevel({ db: ctx.db, target: { sessionId: tree.sessionId } });
  const outcome = await ctx.ports.mountProject({
    sessionId: tree.sessionId,
    name: block.project,
    branch: block.branch,
    reason: block.reason,
    mode: MODE_OF_LEVEL[level],
  });
  const written = writtenOf({ block, outcome });
  await writeRefusal({
    ctx,
    tree,
    runId: ended.runId,
    action: 'mount',
    code: written.code,
    text: written.text,
    roles: [],
    ...(written.mount === undefined ? {} : { mount: written.mount }),
  });
};
