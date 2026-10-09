import { useEffect, useState } from 'react';
import { FileDiffDrawer } from '../../../../../../features/diff/components/FileDiffDrawer';
import { ScriptRunDrawer } from '../../../../../../features/scripts/components/ScriptRunDrawer';
import { ContextDrawer } from '../../../../../../features/session/components/ContextDrawer';
import { SESSION_ID, seedActivityRunScene } from '../../activityRunSeed';
import { BRANCH_FILES_PATCH } from '../../brand/contextDiffPatch';
import { useFakeTauri } from '../../brand/fakeTauri';
import { DrawerCard } from './DrawerCard';
import { prepareHeaders, type HeadersSeed } from './prepare';

const SHEET_WIDTH_PX = 1380;

const HANDLERS = {
  worktree_diff: () => BRANCH_FILES_PATCH,
  db_select: () => [],
  db_execute: () => ({ rowsAffected: 0 }),
};

const noop = () => undefined;

export const DrawerHeadersScene = () => {
  const [seed, setSeed] = useState<HeadersSeed | null>(null);
  useFakeTauri({ handlers: HANDLERS, holdMs: 60_000 });

  useEffect(() => {
    seedActivityRunScene();
    setSeed(prepareHeaders());
  }, []);

  if (seed === null) {
    return null;
  }

  return (
    <main
      className="flex items-start gap-4 bg-background p-4 text-foreground"
      style={{ width: SHEET_WIDTH_PX }}
    >
      <DrawerCard>
        <ContextDrawer
          sessionId={SESSION_ID}
          tab="goal"
          view="versions"
          highlight={[]}
          onClose={noop}
        />
      </DrawerCard>
      <DrawerCard>
        <FileDiffDrawer
          sessionId={SESSION_ID}
          source={{ kind: 'worktree', worktreePath: seed.worktreePath }}
          path={null}
          onClose={noop}
        />
      </DrawerCard>
      <DrawerCard>
        <ScriptRunDrawer
          sessionId={SESSION_ID}
          scriptKey={seed.scriptKey}
          mountId={seed.mountId}
          onClose={noop}
        />
      </DrawerCard>
    </main>
  );
};
