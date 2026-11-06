import { ChevronRight } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { openLens } from '../../../features/session/openLens';

type Props = {
  readonly sessionId: SessionId;
};

export const SpawnedRunsLink = ({ sessionId }: Props) => (
  <div data-spawned-runs-link="" className="flex">
    <Button variant="quiet" size="sm" onClick={() => openLens({ sessionId, lens: 'workflows' })}>
      All runs
      <ChevronRight size={ICON_SIZE.row} aria-hidden className="shrink-0" />
    </Button>
  </div>
);
