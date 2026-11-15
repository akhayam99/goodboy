import { Suspense } from 'react';
import type { ComponentProps } from 'react';
import { lazyNamed } from '../../../shared/lib/lazyNamed';

const Drawer = lazyNamed({
  load: () => import('./ScriptRunDrawer'),
  pick: ({ ScriptRunDrawer }) => ScriptRunDrawer,
});

type Props = ComponentProps<typeof Drawer>;

export const LazyScriptRunDrawer = ({ sessionId, scriptKey, mountId, back, onClose }: Props) => (
  <Suspense
    fallback={
      <p role="status" className="px-4 py-3 text-meta text-muted-foreground">
        Opening the script
      </p>
    }
  >
    <Drawer
      sessionId={sessionId}
      scriptKey={scriptKey}
      mountId={mountId}
      {...(back !== undefined && { back })}
      onClose={onClose}
    />
  </Suspense>
);
