import { isLiveSession } from './isLiveSession';
import { needsYouFieldsOf } from './needsYouFieldsOf';
import { pullRequestFieldsOf } from './pullRequestFieldsOf';
import { runsFieldsOf } from './runsFieldsOf';
import { sessionFieldsOf } from './sessionFieldsOf';
import { sessionsFieldsOf } from './sessionsFieldsOf';
import { tasksFieldsOf } from './tasksFieldsOf';
import type { WorkspaceScope } from './workspaceScope';

export const DETAIL_SESSION_LIMIT = 30;

export type ProjectionKind = 'needsYou' | 'sessions' | 'session' | 'runs' | 'pullRequest' | 'tasks';

export type ProjectionDraft = Readonly<{
  key: string;
  kind: ProjectionKind;
  fields: object;
}>;

type Params = {
  readonly scopes: ReadonlyArray<WorkspaceScope>;
  readonly detailWorkspaceId: string | null;
  readonly now: number;
};

type ScopeParams = {
  readonly scope: WorkspaceScope;
  readonly now: number;
};

const sessionsDraftOf = ({ scope }: ScopeParams): ProjectionDraft => ({
  key: `sessions:${scope.workspace.id}`,
  kind: 'sessions',
  fields: sessionsFieldsOf({ scope }),
});

const tasksDraftOf = ({ scope }: ScopeParams): ProjectionDraft => ({
  key: `tasks:${scope.workspace.id}`,
  kind: 'tasks',
  fields: tasksFieldsOf({ scope }),
});

const detailDraftsOf = ({ scope, now }: ScopeParams): ReadonlyArray<ProjectionDraft> =>
  scope.sessions
    .filter((session) => isLiveSession({ session }))
    .sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1))
    .slice(0, DETAIL_SESSION_LIMIT)
    .flatMap((session) => {
      const detail = sessionFieldsOf({ scope, session, now });
      const pullRequest = pullRequestFieldsOf({ scope, session });
      return [
        ...(detail === null
          ? []
          : [
              {
                key: `session:${scope.workspace.id}:${session.id}`,
                kind: 'session',
                fields: detail,
              } satisfies ProjectionDraft,
            ]),
        {
          key: `runs:${scope.workspace.id}:${session.id}`,
          kind: 'runs',
          fields: runsFieldsOf({ scope, session }),
        } satisfies ProjectionDraft,
        ...(pullRequest === null
          ? []
          : [
              {
                key: `pullRequest:${scope.workspace.id}:${session.id}`,
                kind: 'pullRequest',
                fields: pullRequest,
              } satisfies ProjectionDraft,
            ]),
      ];
    });

export const projectionFieldsOf = ({
  scopes,
  detailWorkspaceId,
  now,
}: Params): ReadonlyArray<ProjectionDraft> => [
  { key: 'needsYou', kind: 'needsYou', fields: needsYouFieldsOf({ scopes, now }) },
  ...scopes.flatMap((scope) => [
    sessionsDraftOf({ scope, now }),
    tasksDraftOf({ scope, now }),
    ...(scope.workspace.id === detailWorkspaceId ? detailDraftsOf({ scope, now }) : []),
  ]),
];
