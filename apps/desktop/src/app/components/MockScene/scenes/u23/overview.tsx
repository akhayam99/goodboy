import { useEffect } from 'react';
import type {
  ChatId,
  ChatSessionLink,
  ChatSessionLinkId,
  ChatSummary,
  IsoDateTime,
  MountBranchObservation,
  MountId,
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
const RELAY_MOUNT = 'mock-mount-relay-backoff' as MountId;

const RELAY_BRANCH = 'fix/notify-relay-webhook-rate-limit-backoff';
const RELAY_OBSERVED = 'fix/notify-relay-retry-budget';

const POLL_MS = 150;

type Variant = 'mismatch' | 'provenance';

type Match = (button: HTMLButtonElement) => boolean;

const CLICKS: Readonly<Record<Variant, Match | null>> = {
  mismatch: null,
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
  mismatch: seedMismatch,
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
  'overview-mount-mismatch': () => <OverviewVariantScene variant="mismatch" />,
  'overview-header-provenance': () => <OverviewVariantScene variant="provenance" />,
};
