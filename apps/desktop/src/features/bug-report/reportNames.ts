import type { Project, Workspace } from '@goodboy/types';

type ReportNamesParams = {
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly projects: ReadonlyArray<Project>;
};

const REPO_NAME = /([^/:]+?)(?:\.git)?\/?$/;

const repoName = ({ remoteUrl }: { readonly remoteUrl: string | undefined }): string | null =>
  remoteUrl == null ? null : (REPO_NAME.exec(remoteUrl)?.[1] ?? null);

export const reportNames = ({ workspaces, projects }: ReportNamesParams): ReadonlyArray<string> => [
  ...workspaces.flatMap((workspace) => [workspace.name, workspace.slug]),
  ...projects.flatMap((project) => {
    const repo = repoName({ remoteUrl: project.remoteUrl });
    return repo == null ? [project.name] : [project.name, repo];
  }),
];
