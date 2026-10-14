import { Pause } from 'lucide-react';
import { WORK_NODE_GLYPH_SIZE, WorkNode } from '@goodboy/ui';
import { LaneRow } from './LaneRow';

type Props = {
  readonly identityIndex: number;
  readonly text: string;
};

export const PauseRow = ({ identityIndex, text }: Props) => (
  <LaneRow
    span="through"
    identityIndex={identityIndex}
    dataStep="pause"
    node={
      <WorkNode
        state="marker"
        tone="warning"
        mark={{ kind: 'glyph', glyph: <Pause size={WORK_NODE_GLYPH_SIZE - 2} aria-hidden /> }}
        label={text}
      />
    }
  >
    <span className="min-w-0 truncate text-label text-muted-foreground">{text}</span>
  </LaneRow>
);
