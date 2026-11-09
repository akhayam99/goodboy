import { Suspense } from 'react';
import type { ComponentProps } from 'react';
import { lazyNamed } from '../../../shared/lib/lazyNamed';

const Pane = lazyNamed({
  load: () => import('./BrowserPane'),
  pick: ({ BrowserPane }) => BrowserPane,
});

type Props = ComponentProps<typeof Pane>;

export const LazyBrowserPane = ({ sessionId, onClose }: Props) => (
  <Suspense
    fallback={
      <p role="status" className="px-4 py-3 text-meta text-muted-foreground">
        Opening the browser
      </p>
    }
  >
    <Pane sessionId={sessionId} onClose={onClose} />
  </Suspense>
);
