import { useEffect, useState } from 'react';
import type { HistoryDraft } from '../../../../../store/slices/history/types';
import { useAppStore } from '../../../../../store/store';
import { ArtifactList } from '../../../../../features/artifacts/components/ArtifactList';
import { ChatList } from '../../../../../features/workspace-chat/components/ChatList';
import { OverviewPanel } from '../../../../../features/impact/components/ImpactStudio/OverviewPanel';
import { TerminalDock } from '../../../../../features/terminal/components/TerminalDock';
import { RecentDecisions } from '../../../../../features/permissions/components/PermissionsSettings/RecentDecisions';
import { HistoryStage } from '../brand/HistoryStage';
import { CTX_PAYMENTS_MOUNT_ID, CTX_SESSION_ID, seedContextBase } from '../brand/contextBase';
import { SESSION_ID, WORKSPACE_ID, seedResolveScene, EXPANDED_THREAD_ID } from '../resolveSeed';

type Props = {
  readonly kind:
    | 'chat-loading'
    | 'artifacts-loading'
    | 'impact-loading'
    | 'commits-loading'
    | 'commits-empty'
    | 'terminal-empty'
    | 'permissions-empty';
};

const NOOP = () => undefined;
const EMPTY_DRAFT: HistoryDraft = {
  sessionId: CTX_SESSION_ID,
  mountId: CTX_PAYMENTS_MOUNT_ID,
  planId: null,
  branch: 'hl/ledger-export',
  baseSha: '',
  headSha: '',
  commits: [],
  items: [],
  onto: null,
  graph: null,
  undo: [],
  prediction: null,
  isPredicting: false,
  loadError: null,
};

export const StatesRestScene = ({ kind }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    if (kind === 'commits-loading' || kind === 'commits-empty') {
      seedContextBase({ lens: 'branch' });
      useAppStore.setState({
        branchTab: { [CTX_SESSION_ID]: 'commits' },
        historyDrafts: kind === 'commits-loading' ? {} : { [CTX_PAYMENTS_MOUNT_ID]: EMPTY_DRAFT },
        loadHistoryDraft: async () => undefined,
      });
      setIsReady(true);
      return;
    }
    seedResolveScene({ expandedThreadId: EXPANDED_THREAD_ID });
    useAppStore.setState({
      chatsByWorkspace: {},
      chatLoadErrors: {},
      sessionArtifacts: {},
      artifactLoadErrors: {},
      terminalTabs: {},
      sessions: kind === 'permissions-empty' ? [] : useAppStore.getState().sessions,
    });
    setIsReady(true);
  }, [kind]);
  if (!isReady) {
    return null;
  }
  return (
    <main className="flex h-screen min-w-0 flex-col bg-background p-6 text-foreground">
      {kind === 'chat-loading' ? (
        <ChatList
          workspaceId={WORKSPACE_ID}
          chats={[]}
          selectedId={null}
          onSelect={NOOP}
          onNew={NOOP}
          onArchived={NOOP}
          onDeleted={NOOP}
        />
      ) : null}
      {kind === 'artifacts-loading' ? (
        <ArtifactList
          sessionId={SESSION_ID}
          rows={[]}
          counts={{ all: 0, plan: 0, report: 0, wireframe: 0 }}
          filter="all"
          onFilterChange={NOOP}
          onOpen={NOOP}
          onImported={NOOP}
        />
      ) : null}
      {kind === 'impact-loading' ? (
        <OverviewPanel
          frame={{ title: 'Impact', meta: null, actions: null, tabs: null }}
          overview={{ data: null, error: null }}
          pullRequests={{ data: null, error: null }}
          reviews={{ data: null, error: null }}
          isLoading
          onRetryOverview={NOOP}
          onRetryShipped={NOOP}
          onSelectTab={NOOP}
          onOpenSession={NOOP}
          onStartSession={NOOP}
        />
      ) : null}
      {kind === 'commits-loading' || kind === 'commits-empty' ? <HistoryStage /> : null}
      {kind === 'terminal-empty' ? (
        <TerminalDock sessionId={SESSION_ID} cwd="/mock/ledger-core" isActive />
      ) : null}
      {kind === 'permissions-empty' ? <RecentDecisions workspaceId={WORKSPACE_ID} /> : null}
    </main>
  );
};
