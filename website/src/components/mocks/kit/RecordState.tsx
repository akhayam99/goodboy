import type { CSSProperties } from 'react';
import './kit.css';
import { Circle, CircleCheck, Contrast, TriangleAlert, type IconComponent } from '../icons';
import { cx } from './cx';
import { TONE_COLOR, type Tone } from './spec';

export type InboxState = 'open' | 'active' | 'done' | 'alert';

type Presentation = {
  readonly icon: IconComponent;
  readonly tone: Tone;
};

export const INBOX_STATE_PRESENTATION: Record<InboxState, Presentation> = {
  open: { icon: Circle, tone: 'info' },
  active: { icon: Contrast, tone: 'warning' },
  done: { icon: CircleCheck, tone: 'neutral' },
  alert: { icon: TriangleAlert, tone: 'danger' },
};

const RECORD_ICON_SIZE = 12;

type Props = {
  readonly category: InboxState;
  readonly label: string;
  readonly className?: string;
};

export const RecordState = ({ category, label, className }: Props) => {
  const { icon: Icon, tone } = INBOX_STATE_PRESENTATION[category];
  return (
    <span className={cx('gkRecord', className)} data-category={category}>
      <span className="gkRecordIcon" style={{ '--gk-tone': TONE_COLOR[tone] } as CSSProperties}>
        <Icon size={RECORD_ICON_SIZE} />
      </span>
      <span className="gkRecordLabel">{label}</span>
    </span>
  );
};
