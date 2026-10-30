import type {
  AgentId,
  ArtifactId,
  FileDiff,
  MountId,
  OpenQuestionId,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import type { ExploreEntry } from '../../../features/explore/explore';
import type { TerminalTabId } from '../../../shared/types/terminal';

export type ArtifactDrawerTab = 'details' | 'chat';

export type ContextDrawerTab = 'goal' | 'decisions' | 'summary' | 'learned';

export type ContextDrawerView = 'current' | 'versions';

export type NewDrawerForm = 'report' | 'wireframe';

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
      readonly kind: 'context';
      readonly payload: {
        readonly tab: ContextDrawerTab;
        readonly view: ContextDrawerView;
        readonly highlight?: ReadonlyArray<number>;
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
      readonly kind: 'explore';
      readonly payload: null;
    }
  | {
      readonly kind: 'scripts';
      readonly payload: null;
    }
  | {
      readonly kind: 'conversation';
      readonly payload: { readonly threadId: string };
    }
  | {
      readonly kind: 'ask';
      readonly payload: null;
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
      readonly kind: 'auto-child';
      readonly payload: { readonly agentId: AgentId };
    }
  | {
      readonly kind: 'spawned';
      readonly payload: { readonly agentId: AgentId } | null;
    }
  | {
      readonly kind: 'session-log';
      readonly payload: { readonly focusEntryId: string | null };
    }
  | {
      readonly kind: 'run-step';
      readonly payload: {
        readonly runId: WorkflowRunId;
        readonly agentId: AgentId;
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

export type DrawerRequest = DrawerContent & {
  readonly sessionId: SessionId;
};

export type OpenDrawer = DrawerRequest;

export type DrawerSliceState = {
  readonly drawer: OpenDrawer | null;
};

export const drawerInitialState: DrawerSliceState = {
  drawer: null,
};
