import { useEffect, useState } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { SpawnedPanel } from '../../../SpawnedPanel';
import { seedActivityRunScene } from '../activityRunSeed';
import { TREE_SEED, TREE_SESSION, type TreeSeed } from './agentsTreeSeed';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly isFocused: boolean;
  readonly seed?: TreeSeed;
};

export const AgentsTreeScene = ({ theme, isFocused, seed = TREE_SEED }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyDocumentTheme({ theme });
    seedActivityRunScene();
    useAppStore.setState((state) => ({
      sessions: [TREE_SESSION],
      sessionPhaseRuns: { [TREE_SESSION.id]: seed.agents },
      agentKindOverride: Object.fromEntries(seed.rootIds.map((id) => [id, 'auto'])),
      autoTreeViews: { [TREE_SESSION.id]: seed.views },
      loadAutoTrees: async () => undefined,
      transcripts: {},
      loadAgentTranscript: async () => undefined,
      selectedAgentId: isFocused ? { [TREE_SESSION.id]: seed.selectedRootId } : {},
      activeLens: isFocused ? { ...state.activeLens, [TREE_SESSION.id]: 'auto' } : state.activeLens,
      focusedWorkflowRunId: {},
      drawer: null,
    }));
    setIsReady(true);
  }, [theme, isFocused, seed]);

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
