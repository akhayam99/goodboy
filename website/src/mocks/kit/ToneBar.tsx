import type { CSSProperties } from 'react';
import './kit.css';
import { cx } from './cx';
import { TONE_COLOR, type Tone } from './spec';

type Props = {
  readonly tone: Tone;
  readonly density?: 'card' | 'row';
  readonly isBreathing?: boolean;
  readonly className?: string;
};

export const ToneBar = ({ tone, density = 'card', isBreathing = false, className }: Props) => (
  <span
    aria-hidden
    className={cx('gkToneBar', isBreathing && 'gkSoftPulse', className)}
    data-density={density}
    style={{ '--gk-tone': TONE_COLOR[tone] } as CSSProperties}
  />
);
