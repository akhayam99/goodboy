import { useEffect, useState } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { SpawnedPanel } from '../../../SpawnedPanel';
import { seedActivityRunScene } from '../activityRunSeed';
import {
  TREE_AGENTS,
  TREE_LIVE_ROOT_ID,
  TREE_ROOT_IDS,
  TREE_SESSION,
  TREE_VIEWS,
} from './agentsTreeSeed';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly isFocused: boolean;
};

export const AgentsTreeScene = ({ theme, isFocused }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyDocumentTheme({ theme });
    seedActivityRunScene();
    useAppStore.setState((state) => ({
      sessions: [TREE_SESSION],
      sessionPhaseRuns: { [TREE_SESSION.id]: TREE_AGENTS },
      agentKindOverride: Object.fromEntries(TREE_ROOT_IDS.map((id) => [id, 'auto'])),
      autoTreeViews: { [TREE_SESSION.id]: TREE_VIEWS },
      loadAutoTrees: async () => undefined,
      transcripts: {},
      loadAgentTranscript: async () => undefined,
      selectedAgentId: isFocused ? { [TREE_SESSION.id]: TREE_LIVE_ROOT_ID } : {},
      activeLens: isFocused ? { ...state.activeLens, [TREE_SESSION.id]: 'auto' } : state.activeLens,
      focusedWorkflowRunId: {},
      drawer: null,
    }));
    setIsReady(true);
  }, [theme, isFocused]);

  if (!isReady) {
    return null;
  }
  return (
    <main className="flex h-screen justify-end bg-background text-foreground">
      <section className="flex h-full w-80 shrink-0 flex-col border-l border-border-soft">
        <SpawnedPanel sessionId={TREE_SESSION.id} onClose={() => undefined} />
      </section>
    </main>
  );
};
