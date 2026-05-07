import type { IsoDateTime, Skill, SkillId, WorkspaceId } from '@kay-am/types';
import type { Database as SqlDatabase } from '@kay-am/db';
import { listSkillsForWorkspace, upsertSkill, deleteSkill } from '@kay-am/db';
import { parseSkillMarkdown, SkillParseError } from './parser';

export interface SkillFs {
  readDir(path: string): Promise<string[]>;
  readFile(path: string): Promise<string>;
  stat(path: string): Promise<{ exists: boolean }>;
}

export interface SkillRegistryDeps {
  readonly fs: SkillFs;
  readonly now: () => IsoDateTime;
}

export class SkillRegistryError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'SkillRegistryError';
  }
}

export class SkillRegistry {
  private readonly fs: SkillFs;
  private readonly now: () => IsoDateTime;

  constructor(deps: SkillRegistryDeps) {
    this.fs = deps.fs;
    this.now = deps.now;
  }

  async scanWorkspace(
    workspaceId: WorkspaceId,
    rootPath: string,
    db: SqlDatabase,
  ): Promise<ReadonlyArray<Skill>> {
    const skillsDir = `${rootPath}/.kay/skills`;

    let filenames: string[];
    try {
      filenames = await this.fs.readDir(skillsDir);
    } catch (err) {
      const { exists } = await this.fs.stat(skillsDir).catch(() => ({ exists: false }));
      if (!exists) {
        filenames = [];
      } else {
        throw new SkillRegistryError(`failed to read skills directory: ${skillsDir}`, err);
      }
    }

    const mdFiles = filenames.filter((f) => f.endsWith('.md'));

    const existing = await listSkillsForWorkspace(db, workspaceId);
    const existingByPath = new Map<string, Skill>(existing.map((s) => [s.filePath, s]));

    const scannedPaths = new Set<string>();
    const result: Skill[] = [];

    for (const filename of mdFiles) {
      const filePath = `${skillsDir}/${filename}`;
      scannedPaths.add(filePath);

      let raw: string;
      try {
        raw = await this.fs.readFile(filePath);
      } catch (err) {
        throw new SkillRegistryError(`failed to read skill file: ${filePath}`, err);
      }

      let parsed: ReturnType<typeof parseSkillMarkdown>;
      try {
        parsed = parseSkillMarkdown(raw);
      } catch (err) {
        if (err instanceof SkillParseError) {
          throw new SkillRegistryError(`malformed skill file ${filePath}: ${err.message}`, err);
        }
        throw err;
      }

      const { frontmatter, body } = parsed;
      const existing_ = existingByPath.get(filePath);
      const now = this.now();

      const skill: Skill = {
        id: existing_?.id ?? (crypto.randomUUID() as SkillId),
        workspaceId,
        name: frontmatter.name,
        description: frontmatter.description,
        filePath,
        body,
        frontmatter,
        createdAt: existing_?.createdAt ?? now,
        updatedAt: now,
      };

      await upsertSkill(db, skill);
      result.push(skill);
    }

    for (const s of existing) {
      if (!scannedPaths.has(s.filePath)) {
        await deleteSkill(db, s.id);
      }
    }

    return result;
  }

  async listSkills(workspaceId: WorkspaceId, db: SqlDatabase): Promise<ReadonlyArray<Skill>> {
    return listSkillsForWorkspace(db, workspaceId);
  }

  async getSkillByName(
    workspaceId: WorkspaceId,
    name: string,
    db: SqlDatabase,
  ): Promise<Skill | null> {
    const skills = await listSkillsForWorkspace(db, workspaceId);
    return skills.find((s) => s.name === name) ?? null;
  }
}
