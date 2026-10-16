import { WorkNode } from '@goodboy/ui';
import type { TailState } from './tailFacts';

type Props = {
  readonly state: TailState;
};

export const TailGlyph = ({ state }: Props) => {
  if (state === 'working' || state === 'queued') {
    return <span className="size-1.5 rounded-full bg-info motion-safe:animate-soft-pulse" />;
  }
  if (state === 'waiting') {
    return <span className="size-3.5 rounded-full ring-2 ring-info ring-inset" />;
  }
  if (state === 'paused') {
    return <WorkNode size="sm" state="budget" mark={{ kind: 'dot' }} label="Paused" />;
  }
  if (state === 'failed') {
    return <WorkNode size="sm" state="failed" mark={{ kind: 'dot' }} label="Failed" />;
  }
  if (state === 'stopped') {
    return <WorkNode size="sm" state="stopped" mark={{ kind: 'dot' }} label="Stopped" />;
  }
  return <span className="size-1.5 rounded-full bg-idle" />;
};
