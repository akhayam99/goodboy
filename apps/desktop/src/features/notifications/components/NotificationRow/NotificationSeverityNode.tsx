import type { NotificationSeverity } from '@goodboy/db';
import { ICON_SIZE, WorkNode, type WorkNodeMark, type WorkNodeState } from '@goodboy/ui';
import { NOTIFICATION_SEVERITY } from '../../severity';

type Props = {
  readonly severity: NotificationSeverity;
};

const NODE_STATE: Record<NotificationSeverity, WorkNodeState> = {
  error: 'failed',
  warning: 'alert',
  success: 'done',
  info: 'marker',
};

const DOT: WorkNodeMark = { kind: 'dot' };

export const NotificationSeverityNode = ({ severity }: Props) => {
  const presentation = NOTIFICATION_SEVERITY[severity];
  const Glyph = presentation.icon;
  const mark: WorkNodeMark =
    severity === 'info'
      ? {
          kind: 'glyph',
          glyph: <Glyph size={ICON_SIZE.row} aria-hidden className="text-muted-foreground" />,
        }
      : DOT;
  return (
    <span
      data-notification-node={severity}
      className="pointer-events-none relative flex h-5 shrink-0 items-center justify-center"
    >
      <WorkNode
        look="quiet"
        size="sm"
        state={NODE_STATE[severity]}
        mark={mark}
        label={presentation.label}
      />
    </span>
  );
};
