import type { Project, ProjectId, ProjectScript } from '@goodboy/types';
import type { ScriptGroup } from './scripts';
import { classifyScript, type ScriptCategory } from './classifyScript';
import { extractPreviewLine } from './extractPreviewLine';
import { scriptPinId } from './scriptPinId';

export type WorkspaceScript = {
  readonly key: string;
  readonly name: string;
  readonly body: string;
  readonly invocation: string;
  readonly relDir: string;
  readonly isPinned: boolean;
};

export type WorkspaceScriptGroup = {
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly rootPath: string;
  readonly status: 'loading' | 'ready' | 'error';
  readonly scripts: ReadonlyArray<WorkspaceScript>;
};

export type ProjectScan = {
  readonly status: 'loading' | 'ready' | 'error';
  readonly groups: ReadonlyArray<ScriptGroup>;
};

type Params = {
  readonly projects: ReadonlyArray<Project>;
  readonly scans: Readonly<Record<string, ProjectScan | undefined>>;
  readonly saved: ReadonlyArray<ProjectScript>;
  readonly pins: Readonly<Record<ProjectId, ReadonlyArray<string>>>;
  readonly projectId: ProjectId | null;
};

type ProjectParams = Omit<Params, 'projects' | 'projectId'> & {
  readonly project: Project;
};

type ManifestEntry = {
  readonly source: ScriptGroup['source'];
  readonly relDir: string;
  readonly script: ScriptGroup['scripts'][number];
  readonly pinId: string;
};

type RowParams = {
  readonly entry: ManifestEntry;
  readonly isPinned: boolean;
};

const SUGGESTED: ReadonlyArray<ScriptCategory> = ['dev', 'build', 'test', 'lint', 'typecheck'];

const groupOf = ({ project, scans, saved, pins }: ProjectParams): WorkspaceScriptGroup => {
  const scan = scans[project.rootPath];
  const status = scan?.status ?? 'loading';
  const pinned = pins[project.id] ?? [];
  const savedRows = saved
    .filter((script) => script.projectId === project.id)
    .map((script): WorkspaceScript => {
      const preview = extractPreviewLine({ body: script.body });
      return {
        key: script.id,
        name: script.name,
        body: preview,
        invocation: preview,
        relDir: '',
        isPinned: pinned.includes(
          scriptPinId({ source: 'saved', relDir: '', name: '', savedId: script.id }),
        ),
      };
    });
  const manifest: ReadonlyArray<ManifestEntry> = (
    scan?.status === 'ready' ? scan.groups : []
  ).flatMap((group) =>
    group.scripts.map((script) => ({
      source: group.source,
      relDir: group.relDir,
      script,
      pinId: scriptPinId({
        source: group.source,
        relDir: group.relDir,
        name: script.name,
        savedId: null,
      }),
    })),
  );
  const rowOf = ({ entry, isPinned }: RowParams): WorkspaceScript => ({
    key: entry.pinId,
    name: entry.script.name,
    body: entry.script.body,
    invocation: entry.script.command,
    relDir: entry.relDir,
    isPinned,
  });
  const pinnedRows = manifest
    .filter((entry) => pinned.includes(entry.pinId))
    .map((entry) => rowOf({ entry, isPinned: true }));
  const suggestedRows = SUGGESTED.flatMap((category) => {
    const match = manifest.find(
      (entry) =>
        entry.source === 'package-json' &&
        entry.relDir === '' &&
        classifyScript({ name: entry.script.name, command: entry.script.body }) === category,
    );
    return match === undefined ? [] : [rowOf({ entry: match, isPinned: false })];
  });
  const listed = [...savedRows, ...pinnedRows];
  return {
    projectId: project.id,
    projectName: project.name,
    rootPath: project.rootPath,
    status,
    scripts: listed.length > 0 ? listed : suggestedRows,
  };
};

export const workspaceScriptsOf = ({
  projects,
  scans,
  saved,
  pins,
  projectId,
}: Params): ReadonlyArray<WorkspaceScriptGroup> =>
  projects
    .filter((project) => projectId === null || project.id === projectId)
    .map((project) => groupOf({ project, scans, saved, pins }));
