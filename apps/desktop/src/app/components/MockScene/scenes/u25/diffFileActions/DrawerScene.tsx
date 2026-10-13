import { useEffect, useRef } from 'react';
import { FileWholeDrawer } from '../../../../../../features/diff/components/FileWholeDrawer';
import { useFakeTauri } from '../../brand/fakeTauri';
import { FILE, HANDLERS } from './seed';

type DrawerProps = { readonly isSplit: boolean };

export const DrawerScene = ({ isSplit }: DrawerProps) => {
  useFakeTauri({ handlers: HANDLERS, holdMs: 60_000 });
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!isSplit) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const tab = Array.from(
        rootRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [],
      ).find((node) => node.textContent === 'Split');
      tab?.click();
    });
    return () => cancelAnimationFrame(frame);
  }, [isSplit]);
  return (
    <div ref={rootRef} className="flex h-[34rem] w-[40rem] flex-col bg-drawer text-foreground">
      <FileWholeDrawer
        worktreePath="/mock/ledger-core"
        whole={{ file: FILE, oldRev: null, newRev: null, baseBranch: 'main' }}
        onClose={() => undefined}
      />
    </div>
  );
};
