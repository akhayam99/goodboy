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
import { scriptPinId } from './scriptPinId';
import { discoveredScriptId, type ScriptGroup, type ScriptSource } from './scripts';
import { projectById } from '../../store/slices/projects/projectIndex';

export type RunnableScriptSource = 'saved' | ScriptSource;

export type RunnableScript = {
  readonly key: string;
  readonly kind: 'saved' | 'manifest';
  readonly name: string;
  readonly body: string;
  readonly invocation: string;
  readonly manager: string;
  readonly source: RunnableScriptSource;
  readonly packageName: string;
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
  readonly packageCount: number;
  readonly scripts: ReadonlyArray<RunnableScript>;
  readonly suggested: ReadonlyArray<RunnableScript>;
};

const SUGGESTED_CATEGORIES: ReadonlyArray<ScriptCategory> = [
  'dev',
  'build',
  'test',
  'lint',
  'typecheck',
];

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
  if (left.source !== right.source) {
    return left.source === 'composer' ? 1 : -1;
  }
  if (left.relDir !== right.relDir) {
    return left.relDir === '' ? -1 : left.relDir.localeCompare(right.relDir);
  }
  const byCategory =
    categoryRank({ category: left.category }) - categoryRank({ category: right.category });
  if (byCategory !== 0) {
    return byCategory;
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
      const preview = extractPreviewLine({ body: script.body });
      return {
        key: script.id,
        kind: 'saved',
        name: script.name,
        body: preview,
        invocation: preview,
        manager: '',
        source: 'saved',
        packageName: '',
        relDir: '',
        category: classifyScript({ name: script.name, command: preview }),
        savedId: script.id,
      };
    });

type ManifestParams = {
  readonly groups: ReadonlyArray<ScriptGroup>;
  readonly worktreePath: string;
  readonly pins: ReadonlyArray<string>;
};

const allManifestScriptsOf = ({
  groups,
  worktreePath,
}: Omit<ManifestParams, 'pins'>): ReadonlyArray<RunnableScript> =>
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
        body: script.body,
        invocation: script.command,
        manager: group.manager,
        source: group.source,
        packageName: group.packageName,
        relDir: group.relDir,
        category: classifyScript({ name: script.name, command: script.body }),
        savedId: null,
      })),
    )
    .sort(compareManifest);

const manifestScriptsOf = ({
  groups,
  worktreePath,
  pins,
}: ManifestParams): ReadonlyArray<RunnableScript> =>
  allManifestScriptsOf({ groups, worktreePath }).filter((script) =>
    pins.includes(scriptPinId(script)),
  );

type SuggestedParams = {
  readonly scripts: ReadonlyArray<RunnableScript>;
};

const suggestedScriptsOf = ({ scripts }: SuggestedParams): ReadonlyArray<RunnableScript> => {
  const root = scripts.filter((script) => script.source === 'package-json' && script.relDir === '');
  return SUGGESTED_CATEGORIES.flatMap((category) => {
    const match = root.find((script) => script.category === category);
    return match === undefined ? [] : [match];
  });
};

type Params = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly projects: ReadonlyArray<Project>;
  readonly saved: ReadonlyArray<ProjectScript>;
  readonly discovered: Readonly<Record<string, ReadonlyArray<ScriptGroup>>> | undefined;
  readonly pins: Readonly<Record<ProjectId, ReadonlyArray<string>>>;
};

export const buildSessionScripts = ({
  mounts,
  projects,
  saved,
  discovered,
  pins,
}: Params): ReadonlyArray<SessionScriptGroup> =>
  mounts.map((mount) => {
    const isReady = mount.worktreePath !== '';
    const manifest = isReady ? (discovered?.[mount.worktreePath] ?? []) : [];
    const pinned = manifestScriptsOf({
      groups: manifest,
      worktreePath: mount.worktreePath,
      pins: pins[mount.projectId] ?? [],
    });
    return {
      mountId: mount.mountId,
      projectId: mount.projectId,
      projectName: projectById(projects, mount.projectId)?.name ?? mount.mountName,
      branch: mount.branch,
      worktreePath: mount.worktreePath,
      isReady,
      packageCount: new Set(pinned.map((script) => `${script.source}:${script.relDir}`)).size,
      scripts: [...savedScriptsOf({ saved, projectId: mount.projectId }), ...pinned],
      suggested:
        pinned.length === 0
          ? suggestedScriptsOf({
              scripts: allManifestScriptsOf({
                groups: manifest,
                worktreePath: mount.worktreePath,
              }),
            })
          : [],
    };
  });
