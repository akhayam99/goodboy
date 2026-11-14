import {
  AUTO_MOUNTED_CODE,
  isAutoMountedCode,
  type AutoBlock,
  type LeadPermissionValue,
  type MountNote,
} from '@goodboy/core/auto';
import type { AutoTree } from '@goodboy/db';
import { readAdmissionPermissions } from '../admission/readAdmissionPermissions';
import type { AutoTurnEnded, MountProjectOutcome, MountProjectParams } from '../ports';
import type { AgentVerbContext } from '../verbContext';
import { writeRefusal } from './writeRefusal';

const MODE_OF_ROW = {
  ask: 'ask',
  whenAllowed: 'allowance',
  allow: 'mount',
} satisfies Readonly<Record<LeadPermissionValue<'addProject'>, MountProjectParams['mode']>>;

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

const mountNoteOfBlock = ({ block, state }: NoteParams): MountNote => ({
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
      mount: mountNoteOfBlock({ block, state: 'ask' }),
    };
  }
  if (outcome.kind === 'elsewhere') {
    return {
      code: 'mount_elsewhere',
      text: `${outcome.name} is already added on branch ${outcome.branch}, not on ${outcome.requested}. Nothing was changed. Work on branch ${outcome.branch}, or ask the user whether to remove ${outcome.name} and add it again on ${outcome.requested}.`,
    };
  }
  if (outcome.kind === 'mounted') {
    const branch = outcome.branch === '' ? '' : ` on branch ${outcome.branch}`;
    return {
      code: AUTO_MOUNTED_CODE,
      text: `Mounted ${outcome.name}${branch}. The folder is ready.`,
      mount: mountNoteOfBlock({ block, state: 'done' }),
    };
  }
  if (outcome.kind === 'failed') {
    return {
      code: 'mount_missing',
      text: `Could not mount ${outcome.name}: ${outcome.error}. Asked the user to confirm the mount.`,
      mount: mountNoteOfBlock({ block, state: 'ask' }),
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

export const applyMountBlock = async ({ ctx, tree, ended, block }: Params): Promise<boolean> => {
  const { addProject } = await readAdmissionPermissions({ db: ctx.db, treeId: tree.id });
  const outcome = await ctx.ports.mountProject({
    sessionId: tree.sessionId,
    name: block.project,
    branch: block.branch,
    reason: block.reason,
    mode: MODE_OF_ROW[addProject],
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
  return isAutoMountedCode({ code: written.code });
};
