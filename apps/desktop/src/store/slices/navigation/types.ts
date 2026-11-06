import type { AgentId, ArtifactId, OpenQuestionId, SessionId, WorkspaceId } from '@goodboy/types';
import type { DiffFocus, FocusedExternalTask, LensKind } from '../session-view/types';
import type { OpenDrawer } from '../drawer/state';
import type { StudioPlace } from './studio';

export type { SetFn, GetFn } from '../../slice-types';

export type BranchTab = 'pr' | 'comments' | 'files' | 'commits' | 'checks';

export type SessionTarget =
  | { readonly kind: 'artifact'; readonly artifactId: ArtifactId }
  | { readonly kind: 'run'; readonly runId: string }
  | { readonly kind: 'github-issue'; readonly issueNumber: number }
  | { readonly kind: 'external-task'; readonly task: FocusedExternalTask }
  | {
      readonly kind: 'diff';
      readonly mountPath: string | null;
      readonly focus: DiffFocus | null;
      readonly page?: 'history' | null;
    }
  | {
      readonly kind: 'branch';
      readonly mountPath: string | null;
      readonly tab: BranchTab;
      readonly threadId: string | null;
      readonly focus: DiffFocus | null;
    }
  | { readonly kind: 'thread'; readonly threadId: string }
  | { readonly kind: 'question'; readonly questionId: OpenQuestionId };

export type SessionView = {
  readonly lens: LensKind | null;
  readonly agentId: AgentId | null;
  readonly target: SessionTarget | null;
};

export type Place =
  | { readonly at: 'board' }
  | { readonly at: 'session-draft' }
  | { readonly at: 'session'; readonly sessionId: SessionId; readonly view: SessionView };

export type PlaceRequest =
  | Place
  | {
      readonly at: 'agent';
      readonly sessionId: SessionId;
      readonly agentId: AgentId;
    };

export type Focus = {
  readonly drawer: OpenDrawer | null;
  readonly scroll: Readonly<Record<string, number>>;
};

export type Location = {
  readonly workspaceId: WorkspaceId | null;
  readonly place: Place;
  readonly studio: StudioPlace | null;
  readonly focus: Focus;
};

export type NavigationStack = {
  readonly entries: ReadonlyArray<Location>;
  readonly index: number;
};

type NavigateMode = 'push' | 'replace';

export type NavigateParams = {
  readonly to: PlaceRequest;
  readonly mode?: NavigateMode;
  readonly drawer?: OpenDrawer | null;
};

export type CanonicalPlace = {
  readonly place: Place;
  readonly drawer: OpenDrawer | null;
};

export type AmendFocusParams = {
  readonly patch: Partial<Focus>;
};

export type StudioParams = {
  readonly studio: StudioPlace;
};

export const EMPTY_FOCUS: Focus = { drawer: null, scroll: {} };

export const HISTORY_LIMIT = 50;
