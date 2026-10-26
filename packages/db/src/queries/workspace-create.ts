import type { Project, Workspace } from '@goodboy/types';
import type { Database, PlainStatement } from '../client';
import { setProjectValueStatement, type ProjectValueWrite } from './entity-value';
import { insertProjectStatement } from './project';
import { setSettingStatement, type SettingWrite } from './settings';
import { insertWorkspaceStatement } from './workspace';

type InsertWorkspaceWithProjectsParams = {
  readonly db: Database;
  readonly workspace: Workspace | null;
  readonly projects: ReadonlyArray<Project>;
  readonly settings: ReadonlyArray<SettingWrite>;
  readonly projectValues: ReadonlyArray<ProjectValueWrite>;
};

export const insertWorkspaceWithProjects = async ({
  db,
  workspace,
  projects,
  settings,
  projectValues,
}: InsertWorkspaceWithProjectsParams): Promise<void> => {
  const statements: ReadonlyArray<PlainStatement> = [
    ...(workspace === null ? [] : [insertWorkspaceStatement({ workspace })]),
    ...projects.map((project) => insertProjectStatement({ project })),
    ...settings.map((setting) => setSettingStatement(setting)),
    ...projectValues.map((value) => setProjectValueStatement(value)),
  ];
  if (statements.length === 0) {
    return;
  }
  const outcome = await db.transaction({ statements });
  if (outcome.status === 'aborted') {
    throw new Error(`the workspace was not created: ${outcome.abortCode}`);
  }
};
