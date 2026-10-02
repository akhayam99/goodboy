import type { CSSProperties, ReactNode } from 'react';
import './kit.css';
import { cx } from './cx';
import { TONE_COLOR, type Tone } from './spec';

export type StateTone = Extract<Tone, 'neutral' | 'success' | 'danger' | 'info' | 'warning'>;

type Props = {
  readonly tone?: StateTone;
  readonly children: ReactNode;
  readonly className?: string;
};

export const StateBadge = ({ tone = 'neutral', children, className }: Props) => (
  <span
    className={cx('gkBadge', className)}
    data-tone={tone}
    style={{ '--gk-tone': TONE_COLOR[tone] } as CSSProperties}
  >
    {children}
  </span>
);
