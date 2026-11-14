import { Suspense } from 'react';
import type { ComponentProps } from 'react';
import { lazyNamed } from '../../../shared/lib/lazyNamed';

const Drawer = lazyNamed({
  load: () => import('./TerminalDrawer'),
  pick: ({ TerminalDrawer }) => TerminalDrawer,
});

type Props = ComponentProps<typeof Drawer>;

export const LazyTerminalDrawer = ({ sessionId, terminalId, onClose }: Props) => (
  <Suspense
    fallback={
      <p role="status" className="px-4 py-3 text-meta text-muted-foreground">
        Opening the terminal
      </p>
    }
  >
    <Drawer sessionId={sessionId} terminalId={terminalId} onClose={onClose} />
  </Suspense>
);
