import type {
  MountId,
  Project,
  ProjectId,
  ProjectScript,
  ProjectScriptId,
  SessionProjectMount,
} from '@goodboy/types';
import { classifyScript, type ScriptCategory } from './classifyScript';
import { extractPreviewLine } from './extractPreviewLine';
import { discoveredScriptId, type ScriptGroup, type ScriptSource } from './scripts';

export type RunnableScriptSource = 'saved' | ScriptSource;

export type RunnableScript = {
  readonly key: string;
  readonly kind: 'saved' | 'manifest';
  readonly name: string;
  readonly command: string;
  readonly source: RunnableScriptSource;
  readonly relDir: string;
  readonly category: ScriptCategory;
  readonly savedId: ProjectScriptId | null;
};

export type SessionScriptGroup = {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly branch: string;
  readonly worktreePath: string;
  readonly isReady: boolean;
  readonly scripts: ReadonlyArray<RunnableScript>;
};

const MANIFEST_CATEGORY_ORDER: ReadonlyArray<ScriptCategory> = [
  'dev',
  'test',
  'build',
  'lint',
  'typecheck',
  'format',
  'db',
  'generate',
  'install',
  'deploy',
  'clean',
  'docs',
  'other',
];

const categoryRank = ({ category }: { readonly category: ScriptCategory }): number =>
  MANIFEST_CATEGORY_ORDER.indexOf(category);

const compareManifest = (left: RunnableScript, right: RunnableScript): number => {
  const byCategory =
    categoryRank({ category: left.category }) - categoryRank({ category: right.category });
  if (byCategory !== 0) {
    return byCategory;
  }
  if (left.source !== right.source) {
    return left.source === 'composer' ? 1 : -1;
  }
  if (left.relDir !== right.relDir) {
    return left.relDir === '' ? -1 : left.relDir.localeCompare(right.relDir);
  }
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
};

const compareSaved = (left: ProjectScript, right: ProjectScript): number =>
  left.sortOrder === right.sortOrder
    ? left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
    : left.sortOrder - right.sortOrder;

type SavedParams = {
  readonly saved: ReadonlyArray<ProjectScript>;
  readonly projectId: ProjectId;
};

const savedScriptsOf = ({ saved, projectId }: SavedParams): ReadonlyArray<RunnableScript> =>
  saved
    .filter((script) => script.projectId === projectId)
    .sort(compareSaved)
    .map((script): RunnableScript => {
      const command = extractPreviewLine({ body: script.body });
      return {
        key: script.id,
        kind: 'saved',
        name: script.name,
        command,
        source: 'saved',
        relDir: '',
        category: classifyScript({ name: script.name, command }),
        savedId: script.id,
      };
    });

type ManifestParams = {
  readonly groups: ReadonlyArray<ScriptGroup>;
  readonly worktreePath: string;
};

const manifestScriptsOf = ({
  groups,
  worktreePath,
}: ManifestParams): ReadonlyArray<RunnableScript> =>
  groups
    .flatMap((group) =>
      group.scripts.map((script): RunnableScript => ({
        key: discoveredScriptId({
          worktreePath,
          source: group.source,
          relDir: group.relDir,
          name: script.name,
        }),
        kind: 'manifest',
        name: script.name,
        command: script.command,
        source: group.source,
        relDir: group.relDir,
        category: classifyScript({ name: script.name, command: script.command }),
        savedId: null,
      })),
    )
    .sort(compareManifest);

type Params = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly projects: ReadonlyArray<Project>;
  readonly saved: ReadonlyArray<ProjectScript>;
  readonly discovered: Readonly<Record<string, ReadonlyArray<ScriptGroup>>> | undefined;
};

export const buildSessionScripts = ({
  mounts,
  projects,
  saved,
  discovered,
}: Params): ReadonlyArray<SessionScriptGroup> =>
  mounts.map((mount) => {
    const isReady = mount.worktreePath !== '';
    const manifest = isReady ? (discovered?.[mount.worktreePath] ?? []) : [];
    return {
      mountId: mount.mountId,
      projectId: mount.projectId,
      projectName:
        projects.find((project) => project.id === mount.projectId)?.name ?? mount.mountName,
      branch: mount.branch,
      worktreePath: mount.worktreePath,
      isReady,
      scripts: [
        ...savedScriptsOf({ saved, projectId: mount.projectId }),
        ...manifestScriptsOf({ groups: manifest, worktreePath: mount.worktreePath }),
      ],
    };
  });
