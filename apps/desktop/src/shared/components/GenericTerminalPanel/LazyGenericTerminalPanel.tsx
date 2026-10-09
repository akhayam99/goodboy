import { Suspense, lazy } from 'react';
import type { ComponentProps } from 'react';

const Panel = lazy(() =>
  import('./index').then((module) => ({ default: module.GenericTerminalPanel })),
);

type Props = ComponentProps<typeof Panel>;

export const LazyGenericTerminalPanel = (props: Props) => (
  <Suspense
    fallback={
      <p role="status" className="text-label text-muted-foreground">
        Starting the shell
      </p>
    }
  >
    <Panel {...props} />
  </Suspense>
);

export type { TerminalDriver } from './index';
