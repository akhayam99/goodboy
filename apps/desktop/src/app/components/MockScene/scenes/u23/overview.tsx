import { useEffect } from 'react';
import type {
  ChatId,
  ChatSessionLink,
  ChatSessionLinkId,
  ChatSummary,
  IsoDateTime,
  MountBranchObservation,
  MountId,
  ProjectId,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { MountsScene } from '../MountsScene';

const clock = sceneClock({ anchor: '2026-09-07T13:15:00.000Z' });

const NOW: IsoDateTime = clock.iso({ at: '2026-09-07T09:12:00.000Z' });

const WORKSPACE_ID = 'mock-workspace-harborline' as WorkspaceId;
const SESSION_ID = 'mock-session-mount-rows' as SessionId;
const LEDGER_ID = 'mock-project-ledger-core' as ProjectId;
const RELAY_MOUNT = 'mock-mount-relay-backoff' as MountId;
const POSTINGS_MOUNT = 'mock-mount-ledger-postings' as MountId;
const ROUNDING_MOUNT = 'mock-mount-ledger-rounding' as MountId;

const RELAY_BRANCH = 'fix/notify-relay-webhook-rate-limit-backoff';
const RELAY_OBSERVED = 'fix/notify-relay-retry-budget';

const LONG_BRANCHES: Readonly<Record<string, string>> = {
  [ROUNDING_MOUNT]:
    'fix/ledger-reconciliation-rounding-drift-in-multi-currency-statement-totals-after-fx-rebase',
  [POSTINGS_MOUNT]:
    'fix/ledger-reconciliation-idempotent-postings-for-replayed-statement-batches-after-gateway-timeouts',
  [RELAY_MOUNT]:
    'fix/notify-relay-webhook-rate-limit-backoff-with-jitter-and-retry-budget-per-tenant',
};

const POLL_MS = 150;

type Variant =
  'error' | 'mismatch' | 'loading' | 'add-project-empty' | 'long-branches' | 'provenance';

type Match = (button: HTMLButtonElement) => boolean;

const startsWithLabel =
  ({ prefix }: { readonly prefix: string }): Match =>
  (button) =>
    button.getAttribute('aria-label')?.startsWith(prefix) === true;

const CLICKS: Readonly<Record<Variant, Match | null>> = {
  error: startsWithLabel({ prefix: 'Reopen for' }),
  mismatch: null,
  loading: null,
  'add-project-empty': startsWithLabel({ prefix: 'Add project' }),
  'long-branches': null,
  provenance: (button) => /^\+\d+ more$/.test(button.textContent ?? ''),
};

const chatOf = ({ id, title }: { readonly id: string; readonly title: string }): ChatSummary => ({
  id: id as ChatId,
  workspaceId: WORKSPACE_ID,
  title,
  provider: 'anthropic',
  model: 'sonnet-5',
  effort: null,
  pinnedAt: null,
  archivedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  lastActivityAt: NOW,
  preview: null,
  modelsUsed: [],
  messageCount: 0,
});

const linkOf = ({
  chatId,
  kind,
  minutes,
}: {
  readonly chatId: string;
  readonly kind: ChatSessionLink['kind'];
  readonly minutes: number;
}): ChatSessionLink => ({
  id: `mock-link-${chatId}-${kind}` as ChatSessionLinkId,
  chatId: chatId as ChatId,
  sessionId: SESSION_ID,
  messageId: null,
  kind,
  createdAt: clock.iso({ at: `2026-09-07T09:${String(10 + minutes).padStart(2, '0')}:00.000Z` }),
});

const longTaskOf = ({
  index,
  branch,
}: {
  readonly index: number;
  readonly branch: string;
}): SessionExternalTask => ({
  sessionId: SESSION_ID,
  provider: 'linear',
  externalId: `mock-long-hbl-${index}`,
  identifier: `HBL-${400 + index}`,
  url: `https://example.invalid/linear/HBL-${400 + index}`,
  title: `Ledger task ${index}`,
  scope: 'branch',
  branch,
  projectId: LEDGER_ID,
  createdAt: NOW,
});

const seedMismatch = (): void => {
  const observation: MountBranchObservation = {
    mountId: RELAY_MOUNT,
    sessionId: SESSION_ID,
    state: 'mismatch',
    recordedBranch: RELAY_BRANCH,
    observedBranch: RELAY_OBSERVED,
    revision: 4,
    observedAt: NOW,
  };
  useAppStore.setState({ mountBranchObservations: { [SESSION_ID]: [observation] } });
};

const seedFailingReopen = (): void => {
  useAppStore.setState({
    attachMount: async () => {
      throw new Error(
        "fatal: '~/code/harborline/ledger-core-backfill' is already registered as a worktree of another process",
      );
    },
  });
};

const seedLoading = (): void => {
  useAppStore.setState({ sessionProjectMounts: {}, sessionMounts: {} });
};

const seedLongBranches = (): void => {
  const state = useAppStore.getState();
  const longOf = (mountId: string, branch: string): string => LONG_BRANCHES[mountId] ?? branch;
  const postings = LONG_BRANCHES[POSTINGS_MOUNT] ?? '';
  const rounding = LONG_BRANCHES[ROUNDING_MOUNT] ?? '';
  useAppStore.setState({
    sessionMounts: {
      [SESSION_ID]: (state.sessionMounts[SESSION_ID] ?? []).map((view) => ({
        ...view,
        branch: longOf(view.id, view.branch),
      })),
    },
    sessionProjectMounts: {
      [SESSION_ID]: (state.sessionProjectMounts[SESSION_ID] ?? []).map((mount) => ({
        ...mount,
        branch: longOf(mount.mountId, mount.branch),
      })),
    },
    sessionExternalTasks: {
      [SESSION_ID]: [
        ...(state.sessionExternalTasks[SESSION_ID] ?? []).filter((task) => task.scope !== 'branch'),
        ...[1, 2, 3, 4].map((index) => longTaskOf({ index, branch: postings })),
        longTaskOf({ index: 5, branch: rounding }),
      ],
    },
  });
};

const seedProvenance = (): void => {
  useAppStore.setState({
    chatsByWorkspace: {
      [WORKSPACE_ID]: [
        chatOf({ id: 'mock-chat-retry', title: 'Payments retry design' }),
        chatOf({ id: 'mock-chat-rounding', title: 'Ledger rounding' }),
        chatOf({ id: 'mock-chat-relay', title: 'Relay backoff notes' }),
      ],
    },
    archivedChatsByWorkspace: { [WORKSPACE_ID]: [] },
    chatLinks: {
      ['mock-chat-retry' as ChatId]: [
        linkOf({ chatId: 'mock-chat-retry', kind: 'new', minutes: 0 }),
      ],
      ['mock-chat-rounding' as ChatId]: [
        linkOf({ chatId: 'mock-chat-rounding', kind: 'add', minutes: 1 }),
      ],
      ['mock-chat-relay' as ChatId]: [
        linkOf({ chatId: 'mock-chat-relay', kind: 'add', minutes: 2 }),
      ],
    },
    loadChats: async () => undefined,
    loadArchivedChats: async () => [],
  });
};

const SEEDS: Readonly<Record<Variant, () => void>> = {
  error: seedFailingReopen,
  mismatch: seedMismatch,
  loading: seedLoading,
  'add-project-empty': () => undefined,
  'long-branches': seedLongBranches,
  provenance: seedProvenance,
};

type Props = {
  readonly variant: Variant;
};

const OverviewVariantScene = ({ variant }: Props) => {
  useEffect(() => {
    SEEDS[variant]();
  }, []);
  useEffect(() => {
    const isMatch = CLICKS[variant];
    if (isMatch === null) {
      return;
    }
    const interval = window.setInterval(() => {
      const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(isMatch);
      if (button === undefined) {
        return;
      }
      window.clearInterval(interval);
      button.click();
    }, POLL_MS);
    return () => window.clearInterval(interval);
  }, []);
  return <MountsScene variant="mounts" />;
};

export const U23_OVERVIEW_SCENES = {
  'overview-mount-error': () => <OverviewVariantScene variant="error" />,
  'overview-mount-mismatch': () => <OverviewVariantScene variant="mismatch" />,
  'overview-mount-loading': () => <OverviewVariantScene variant="loading" />,
  'overview-add-project-empty': () => <OverviewVariantScene variant="add-project-empty" />,
  'overview-long-branches': () => <OverviewVariantScene variant="long-branches" />,
  'overview-header-provenance': () => <OverviewVariantScene variant="provenance" />,
};
