import type {
  AgentId,
  ArtifactId,
  AutoTreeId,
  FileDiff,
  MountId,
  OpenQuestionId,
  ProjectId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { ExploreEntry } from '../../../features/explore/explore';
import type { TerminalTabId } from '../../../shared/types/terminal';

export type ArtifactDrawerTab = 'details' | 'chat';

export type ContextDrawerSection = 'goal' | 'decisions' | 'summary' | 'explanations';

export type ContextDrawerView = 'current' | 'versions';

export type NewDrawerForm = 'report' | 'wireframe';

export type PullRequestDrawerTab = 'checks' | 'conversation';

export type NewDrawerPayload = {
  readonly form: NewDrawerForm;
  readonly note?: string;
};

export type DrawerContent =
  | {
      readonly kind: 'check-analysis';
      readonly payload: {
        readonly sessionId: SessionId;
        readonly mountId: MountId;
        readonly checkUrl: string;
      };
    }
  | {
      readonly kind: 'explore-file';
      readonly payload: {
        readonly sessionDir: string;
        readonly entry: ExploreEntry;
        readonly line?: number;
        readonly from?: 'explore';
      };
    }
  | {
      readonly kind: 'artifact';
      readonly payload: { readonly artifactId: ArtifactId; readonly tab: ArtifactDrawerTab };
    }
  | {
      readonly kind: 'artifact-document';
      readonly payload: { readonly artifactId: ArtifactId; readonly revision: number | null };
    }
  | {
      readonly kind: 'plan-part';
      readonly payload: { readonly planId: ArtifactId; readonly index: number };
    }
  | {
      readonly kind: 'scriptRun';
      readonly payload: {
        readonly scriptKey: string;
        readonly mountId: MountId | null;
        readonly from?: 'scripts';
      };
    }
  | {
      readonly kind: 'scripts';
      readonly payload: { readonly projectId: ProjectId } | null;
    }
  | {
      readonly kind: 'conversation';
      readonly payload: { readonly threadId: string };
    }
  | {
      readonly kind: 'question';
      readonly payload: { readonly questionId: OpenQuestionId; readonly from?: 'ask' };
    }
  | {
      readonly kind: 'new';
      readonly payload: NewDrawerPayload;
    }
  | {
      readonly kind: 'transcript';
      readonly payload: {
        readonly agentId: AgentId;
        readonly turn?: number;
        readonly toolUseId?: string;
      };
    }
  | {
      readonly kind: 'pull-request';
      readonly payload: {
        readonly mountId: MountId;
        readonly tab: PullRequestDrawerTab;
        readonly check?: string;
      };
    }
  | {
      readonly kind: 'fix-comments';
      readonly payload: {
        readonly mountId: MountId | null;
        readonly focusThreadId?: string | null;
        readonly threadIds?: ReadonlyArray<string>;
        readonly fromThreadId?: string;
      };
    }
  | {
      readonly kind: 'terminal';
      readonly payload: { readonly terminalId: TerminalTabId };
    }
  | {
      readonly kind: 'browser';
      readonly payload: null;
    }
  | {
      readonly kind: 'monitoring';
      readonly payload: null;
    }
  | {
      readonly kind: 'ask';
      readonly payload: null;
    }
  | {
      readonly kind: 'history-versions';
      readonly payload: { readonly mountId: MountId; readonly worktreePath: string };
    }
  | {
      readonly kind: 'file-diff';
      readonly payload: {
        readonly source: FileDiffSource;
        readonly path: string | null;
        readonly whole?: FileDiffWhole;
      };
    }
  | {
      readonly kind: 'lead-details';
      readonly payload: { readonly workspaceId: WorkspaceId; readonly treeId: AutoTreeId };
    }
  | {
      readonly kind: 'identifier-peek';
      readonly payload: {
        readonly worktreePath: string;
        readonly word: string;
        readonly selected: IdentifierPeekSelection;
      };
    };

export type IdentifierPeekSelection = {
  readonly path: string;
  readonly line: number;
};

export type FileDiffWhole = {
  readonly file: FileDiff;
  readonly oldRev: string | null;
  readonly newRev: string | null;
  readonly baseBranch: string | null;
};

export type FileDiffSource =
  | { readonly kind: 'worktree'; readonly worktreePath: string }
  | { readonly kind: 'commit'; readonly repo: string; readonly sha: string };

export type WorkspaceToolKind = 'terminal' | 'browser' | 'monitoring' | 'scripts' | 'ask';

export const WORKSPACE_TOOL_KINDS: ReadonlyArray<WorkspaceToolKind> = [
  'terminal',
  'browser',
  'monitoring',
  'scripts',
  'ask',
];

type SessionlessToolKind = WorkspaceToolKind;

export type DrawerRequest =
  | (DrawerContent & { readonly sessionId: SessionId })
  | (Extract<DrawerContent, { readonly kind: SessionlessToolKind }> & {
      readonly sessionId: null;
    });

export type OpenDrawer = DrawerRequest;

export type DrawerFocus =
  | { readonly at: 'page' }
  | { readonly at: 'detail' }
  | { readonly at: 'tool'; readonly kind: DrawerContent['kind'] };

export type DrawerGridWidths = Readonly<Partial<Record<DrawerContent['kind'], number>>>;

export type DrawerGridSplits = Readonly<Record<string, number>>;

export type DrawerGridTab = {
  readonly keys: ReadonlyArray<string>;
  readonly active: string;
};

export type DrawerGridTabs = Readonly<Record<string, DrawerGridTab>>;

export type DrawerGrid = {
  readonly columns: ReadonlyArray<ReadonlyArray<OpenDrawer>>;
  readonly tabs?: DrawerGridTabs;
  readonly used: ReadonlyArray<DrawerContent['kind']>;
  readonly focus: DrawerFocus;
  readonly widths: DrawerGridWidths;
  readonly splits: DrawerGridSplits;
};

export type DrawerFocusTarget =
  { readonly at: 'page' } | { readonly at: 'panel'; readonly entry: OpenDrawer };

export const EMPTY_DRAWER_GRID: DrawerGrid = {
  columns: [],
  used: [],
  focus: { at: 'page' },
  widths: {},
  splits: {},
};

export type DrawerSliceState = {
  readonly drawer: OpenDrawer | null;
  readonly drawerBack: OpenDrawer | null;
  readonly drawerGrid: DrawerGrid;
};

export const drawerInitialState: DrawerSliceState = {
  drawer: null,
  drawerBack: null,
  drawerGrid: EMPTY_DRAWER_GRID,
};
