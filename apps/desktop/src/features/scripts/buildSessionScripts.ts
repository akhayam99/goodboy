import type { ScriptLedgerEntry } from '@goodboy/db';
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
import {
  discoveredScriptId,
  type ScriptGroup,
  type ScriptRunRecord,
  type ScriptSource,
} from './scripts';
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

export type ScriptLastOutcome = 'ok' | 'error' | 'cancelled' | 'unfinished';

export type ScriptLastRun = {
  readonly runId: string;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly exitCode: number | null;
  readonly outcome: ScriptLastOutcome;
  readonly runCount: number;
};

export type LedgerScript = RunnableScript & {
  readonly lastRun: ScriptLastRun | null;
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
  readonly available: ReadonlyArray<LedgerScript>;
};

const STOP_EXIT_CODES: ReadonlyArray<number> = [130, 137, 143];

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

const SOURCE_ORDER: ReadonlyArray<RunnableScriptSource> = [
  'saved',
  'package-json',
  'make',
  'just',
  'cargo',
  'pyproject',
  'composer',
];

const categoryRank = ({ category }: { readonly category: ScriptCategory }): number =>
  MANIFEST_CATEGORY_ORDER.indexOf(category);

const compareManifest = (left: RunnableScript, right: RunnableScript): number => {
  if (left.source !== right.source) {
    return SOURCE_ORDER.indexOf(left.source) - SOURCE_ORDER.indexOf(right.source);
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
};

const allManifestScriptsOf = ({
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
  readonly runs?: Readonly<Record<string, ScriptRunRecord>> | undefined;
  readonly ledger?: ReadonlyArray<ScriptLedgerEntry> | undefined;
};

type OutcomeParams = {
  readonly entry: ScriptLedgerEntry;
};

const outcomeOf = ({ entry }: OutcomeParams): ScriptLastOutcome => {
  if (entry.endedAt === null || entry.exitCode === null) {
    return 'unfinished';
  }
  if (entry.exitCode === 0) {
    return 'ok';
  }
  return STOP_EXIT_CODES.includes(entry.exitCode) ? 'cancelled' : 'error';
};

type LastRunParams = {
  readonly ledger: ReadonlyArray<ScriptLedgerEntry> | undefined;
  readonly mountId: MountId;
  readonly key: string;
};

const lastRunOf = ({ ledger, mountId, key }: LastRunParams): ScriptLastRun | null => {
  const matches = (ledger ?? []).filter(
    (entry) => entry.scriptId === key && (entry.mountId === null || entry.mountId === mountId),
  );
  const latest = matches.reduce<ScriptLedgerEntry | null>(
    (best, entry) => (best === null || entry.startedAt > best.startedAt ? entry : best),
    null,
  );
  if (latest === null) {
    return null;
  }
  return {
    runId: latest.runId,
    startedAt: latest.startedAt,
    endedAt: latest.endedAt,
    exitCode: latest.exitCode,
    outcome: outcomeOf({ entry: latest }),
    runCount: matches.reduce((total, entry) => total + entry.runCount, 0),
  };
};

type KeptParams = {
  readonly suggested: ReadonlyArray<RunnableScript>;
  readonly pinned: ReadonlyArray<RunnableScript>;
  readonly runs: Readonly<Record<string, ScriptRunRecord>> | undefined;
  readonly mountId: MountId;
};

const keptSuggestedOf = ({
  suggested,
  pinned,
  runs,
  mountId,
}: KeptParams): ReadonlyArray<RunnableScript> =>
  suggested.filter((script) => {
    const record = runs?.[script.key];
    return (
      record !== undefined &&
      (record.mountId === undefined || record.mountId === mountId) &&
      !pinned.some((candidate) => candidate.key === script.key)
    );
  });

export const buildSessionScripts = ({
  mounts,
  projects,
  saved,
  discovered,
  pins,
  runs,
  ledger,
}: Params): ReadonlyArray<SessionScriptGroup> =>
  mounts.map((mount) => {
    const isReady = mount.worktreePath !== '';
    const manifest = isReady ? (discovered?.[mount.worktreePath] ?? []) : [];
    const everyManifest = allManifestScriptsOf({
      groups: manifest,
      worktreePath: mount.worktreePath,
    });
    const projectPins = pins[mount.projectId] ?? [];
    const pinned = everyManifest.filter((script) => projectPins.includes(scriptPinId(script)));
    const savedScripts = savedScriptsOf({ saved, projectId: mount.projectId });
    const suggested = suggestedScriptsOf({ scripts: everyManifest });
    const available = [...savedScripts, ...everyManifest].map((script): LedgerScript => ({
      ...script,
      lastRun: lastRunOf({ ledger, mountId: mount.mountId, key: script.key }),
    }));
    return {
      mountId: mount.mountId,
      projectId: mount.projectId,
      projectName: projectById(projects, mount.projectId)?.name ?? mount.mountName,
      branch: mount.branch,
      worktreePath: mount.worktreePath,
      isReady,
      packageCount: new Set(pinned.map((script) => `${script.source}:${script.relDir}`)).size,
      scripts: [...savedScripts, ...pinned],
      suggested:
        pinned.length === 0
          ? suggested
          : keptSuggestedOf({ suggested, pinned, runs, mountId: mount.mountId }),
      available,
    };
  });
