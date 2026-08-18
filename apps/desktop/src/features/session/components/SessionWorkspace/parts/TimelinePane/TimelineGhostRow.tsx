import { Button } from '@goodboy/ui';
import { TimelineRow } from './TimelineRow';

type Props = {
  readonly title: string;
  readonly canAdvance: boolean;
  readonly onAdvance: () => void;
};

export const TimelineGhostRow = ({ title, canAdvance, onAdvance }: Props) => (
  <TimelineRow
    timeLabel={null}
    depth={1}
    hasRoleColumn
    marker={
      <span
        className="size-1.5 rounded-full border border-dashed border-muted-foreground"
        aria-label="Pending step"
      />
    }
    label={<span className="min-w-0 truncate text-sm text-muted-foreground">{title}</span>}
    trailing={
      canAdvance ? (
        <Button variant="ghost" size="sm" onClick={onAdvance}>
          Start step
        </Button>
      ) : null
    }
  />
);
