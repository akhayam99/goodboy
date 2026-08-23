import { invoke } from '@tauri-apps/api/core';
import type { IsoDateTime, Skill, SkillFrontmatter, SkillId, WorkspaceId } from '@goodboy/types';
import { serializeSkillMarkdown, SkillExecutor } from '@goodboy/core';
import type { SkillScriptRunner } from '@goodboy/core';

export type ResolveSkillInvocationArgs = {
  readonly skill: Skill;
  readonly args: ReadonlyArray<string>;
  readonly workingDir: string;
  readonly projectRoot: string;
};

export type ResolveSkillInvocationResult = {
  readonly resolvedPrompt: string;
  readonly skillName: string;
  readonly args: ReadonlyArray<string>;
};

export const resolveSkillInvocation = async (
  input: ResolveSkillInvocationArgs,
): Promise<ResolveSkillInvocationResult> => {
  const { resolvedPrompt } = await invokeSkillInvoke({
    skillId: input.skill.id,
    args: input.args,
    workingDir: input.workingDir,
    projectRoot: input.projectRoot,
  });
  return { resolvedPrompt, skillName: input.skill.name, args: input.args };
};

type RawSkillRow = {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly description: string;
  readonly filePath: string;
  readonly body: string;
  readonly frontmatterJson: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function rowToSkill(row: RawSkillRow): Skill {
  return {
    id: row.id as SkillId,
    workspaceId: row.workspaceId as WorkspaceId,
    name: row.name,
    description: row.description,
    filePath: row.filePath,
    body: row.body,
    frontmatter: JSON.parse(row.frontmatterJson) as SkillFrontmatter,
    createdAt: row.createdAt as IsoDateTime,
    updatedAt: row.updatedAt as IsoDateTime,
  };
}

export const invokeSkillList = async (workspaceId: WorkspaceId): Promise<Skill[]> => {
  const rows = await invoke<RawSkillRow[]>('skill_list', { workspaceId });
  return rows.map(rowToSkill);
};

export type SkillUpsertArgs = {
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly description: string;
  readonly frontmatter: SkillFrontmatter;
  readonly body: string;
  readonly filePath?: string;
};

export const invokeSkillUpsert = async (args: SkillUpsertArgs): Promise<Skill> => {
  const markdown = serializeSkillMarkdown(args.frontmatter, args.body);
  const row = await invoke<RawSkillRow>('skill_upsert', {
    input: {
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      frontmatterJson: JSON.stringify(args.frontmatter),
      body: args.body,
      markdown,
      filePath: args.filePath ?? null,
    },
  });
  return rowToSkill(row);
};

export const invokeSkillDelete = async (skillId: SkillId): Promise<void> => {
  return invoke<void>('skill_delete', { skillId });
};

export const invokeSkillRescan = async (workspaceId: WorkspaceId): Promise<Skill[]> => {
  const rows = await invoke<RawSkillRow[]>('skill_rescan', { workspaceId });
  return rows.map(rowToSkill);
};

type SkillInvokeArgs = {
  readonly skillId: SkillId;
  readonly args: ReadonlyArray<string>;
  readonly workingDir: string;
  readonly projectRoot: string;
};

type SkillInvokeResult = {
  readonly resolvedPrompt: string;
};

async function invokeSkillInvoke(args: SkillInvokeArgs): Promise<SkillInvokeResult> {
  const rawRow = await invoke<RawSkillRow | null>('skill_get', { skillId: args.skillId });
  if (!rawRow) {
    throw new Error(`skill not found: ${args.skillId}`);
  }

  const frontmatter: SkillFrontmatter = JSON.parse(rawRow.frontmatterJson);
  const skill: Skill = {
    id: rawRow.id as SkillId,
    workspaceId: rawRow.workspaceId as WorkspaceId,
    name: rawRow.name,
    description: rawRow.description,
    filePath: rawRow.filePath,
    body: rawRow.body,
    frontmatter,
    createdAt: rawRow.createdAt as IsoDateTime,
    updatedAt: rawRow.updatedAt as IsoDateTime,
  };

  const projectRoot = args.projectRoot;

  const tauriRunner: SkillScriptRunner = {
    async runScript(
      scriptPath: string,
      runArgs: ReadonlyArray<string>,
      cwd: string,
    ): Promise<string> {
      const result = await invoke<{ stdout: string }>('skill_run_script', {
        input: {
          scriptPath,
          args: [...runArgs],
          workingDir: cwd,
          projectRoot,
        },
      });
      return result.stdout;
    },
  };

  const executor = new SkillExecutor();
  const resolvedPrompt = await executor.resolve({
    skill,
    args: args.args,
    workingDir: args.workingDir,
    runner: tauriRunner,
  });

  return { resolvedPrompt };
}
