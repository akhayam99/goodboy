import type { RunRouteShape, SessionId, WorkspaceId } from '@goodboy/types';

export type RunDefault = 'auto' | RunRouteShape;

export type RunDefaultScope =
  | Readonly<{ kind: 'session'; sessionId: SessionId }>
  | Readonly<{ kind: 'workspace'; workspaceId: WorkspaceId }>;

type KeyParams = {
  readonly scope: RunDefaultScope;
};

export const runDefaultKey = ({ scope }: KeyParams): string =>
  scope.kind === 'session'
    ? `runs.defaultShape.session.${scope.sessionId}`
    : `runs.defaultShape.${scope.workspaceId}`;

type RawParams = {
  readonly raw: string | null | undefined;
};

export const parseRunDefault = ({ raw }: RawParams): RunDefault | null =>
  raw === 'auto' || raw === 'plan' || raw === 'lead' ? raw : null;

type LeadDefault = Readonly<{
  shouldSuggestWorkflow: boolean;
  shouldAskPlan: boolean;
}>;

type ShapeParams = {
  readonly shape: RunDefault;
};

export const leadDefaultOf = ({ shape }: ShapeParams): LeadDefault => ({
  shouldSuggestWorkflow: shape === 'auto',
  shouldAskPlan: shape === 'plan',
});
