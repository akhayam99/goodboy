import { Suspense, lazy } from 'react';
import type { ComponentProps } from 'react';
import type { GenericTerminalPanel } from './index';

const Panel = lazy(() =>
  import('./index').then((module) => ({ default: module.GenericTerminalPanel })),
);

type Props = ComponentProps<typeof GenericTerminalPanel>;

export const LazyGenericTerminalPanel = (props: Props) => (
  <Suspense fallback={<div className="h-full w-full bg-background" aria-hidden />}>
    <Panel {...props} />
  </Suspense>
);

export type { TerminalDriver } from './index';
