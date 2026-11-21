import { Suspense } from 'react';
import { lazyNamed } from '../../../../shared/lib/lazyNamed';

const Drawer = lazyNamed({
  load: () => import('./MonitoringDrawer'),
  pick: ({ MonitoringDrawer }) => MonitoringDrawer,
});

type Props = {
  readonly onClose: () => void;
};

export const LazyMonitoringDrawer = ({ onClose }: Props) => (
  <Suspense
    fallback={
      <p role="status" className="px-4 py-3 text-meta text-muted-foreground">
        Opening the monitor
      </p>
    }
  >
    <Drawer onClose={onClose} />
  </Suspense>
);
