import type { ReactNode } from 'react';
import type { Tone } from '../tint';
import { Chip } from './Chip';

type StateTone = Extract<Tone, 'neutral' | 'success' | 'danger' | 'info' | 'warning'>;

type Props = {
  readonly tone?: StateTone;
  readonly children: ReactNode;
};

export const StateBadge = ({ tone = 'neutral', children }: Props) => (
  <Chip kind="state" tone={tone} label={children} />
);

export type { StateTone };
