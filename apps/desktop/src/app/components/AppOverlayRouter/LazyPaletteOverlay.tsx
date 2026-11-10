import { Suspense } from 'react';
import type { ComponentProps } from 'react';
import { lazyNamed } from '../../../shared/lib/lazyNamed';

const Overlay = lazyNamed({
  load: () => import('../../../features/palette/components/PaletteOverlay'),
  pick: ({ PaletteOverlay }) => PaletteOverlay,
});

type Props = ComponentProps<typeof Overlay>;

export const LazyPaletteOverlay = ({ mode, initialQuery, onClose }: Props) => (
  <Suspense fallback={null}>
    <Overlay mode={mode} initialQuery={initialQuery} onClose={onClose} />
  </Suspense>
);
