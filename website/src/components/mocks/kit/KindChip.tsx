import type { CSSProperties } from 'react';
import './kit.css';
import { AGENT_KIND_PALETTE, UNKNOWN_KIND_COLOR, type AgentKind } from './spec';
import { cx } from './cx';

type Props = {
  readonly kind: AgentKind | 'unknown';
  readonly label?: string;
  readonly muted?: boolean;
  readonly hug?: boolean;
  readonly className?: string;
};

export const KindChip = ({ kind, label, muted = false, hug = false, className }: Props) => {
  const palette = kind === 'unknown' ? null : AGENT_KIND_PALETTE[kind];
  const text = label ?? palette?.label ?? '?';
  const style = {
    '--gk-kind': palette?.color ?? UNKNOWN_KIND_COLOR,
  } as CSSProperties;
  return (
    <span
      className={cx('gkKind', muted && 'gkKindMuted', hug && 'gkKindHug', className)}
      data-kind={kind}
      style={style}
    >
      {text}
    </span>
  );
};
