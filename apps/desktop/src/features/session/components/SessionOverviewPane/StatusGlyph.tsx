import { Check, Clock } from 'lucide-react';
import { StatusDot } from '@goodboy/ui';
import type { SpawnNodeStatus } from '../../../orchestration/components/SpawnTree/lib';

type Props = {
  readonly status: SpawnNodeStatus;
};

export const StatusGlyph = ({ status }: Props) =>
  status === 'running' ? (
    <StatusDot tone="info" size="md" pulsing />
  ) : status === 'done' ? (
    <span className="flex size-3.5 items-center justify-center rounded-full bg-success/15">
      <Check size={9} aria-hidden className="text-success" />
    </span>
  ) : status === 'stalled' ? (
    <span className="size-1.5 rounded-full bg-danger" aria-hidden />
  ) : (
    <Clock size={11} aria-hidden className="text-muted-foreground/60" />
  );
