import type { IsoDateTime, SkillId, WorkspaceId } from './ids';

export type SkillFrontmatter = {
  readonly name: string;
  readonly description: string;
  readonly args?: ReadonlyArray<string>;
  readonly scripts?: ReadonlyArray<string>;
};

export type Skill = {
  readonly id: SkillId;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly description: string;
  readonly filePath: string;
  readonly body: string;
  readonly frontmatter: SkillFrontmatter;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
};

export type SkillInvocation = {
  readonly skillId: SkillId;
  readonly args: ReadonlyArray<string>;
};

export type SlashCommand = {
  readonly name: string;
  readonly args: ReadonlyArray<string>;
  readonly raw: string;
};
