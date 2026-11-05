import type { CSSProperties, ReactNode } from 'react';
import './kit.css';
import { AppBrandIcon, type AppBrandId } from '../icons';
import { cx } from './cx';
import { TONE_COLOR, type Tone } from './spec';

export type ChipSize = '3xs' | 'xs' | 'sm' | 'md' | 'control';
export type ChipEmphasis = 'subtle' | 'soft' | 'strong';

type Props = {
  readonly tone?: Tone;
  readonly label?: ReactNode;
  readonly icon?: ReactNode;
  readonly brand?: AppBrandId;
  readonly trailing?: ReactNode;
  readonly size?: ChipSize;
  readonly shape?: 'pill' | 'badge';
  readonly bordered?: boolean;
  readonly emphasis?: ChipEmphasis;
  readonly as?: 'span' | 'button';
  readonly title?: string;
  readonly ariaLabel?: string;
  readonly className?: string;
};

const BRAND_ICON_SIZE = 12;

export const Chip = ({
  tone = 'neutral',
  label,
  icon,
  brand,
  trailing,
  size = 'xs',
  shape = 'pill',
  bordered = true,
  emphasis = 'soft',
  as = 'span',
  title,
  ariaLabel,
  className,
}: Props) => {
  const Tag = as;
  const style = { '--gk-tone': TONE_COLOR[tone] } as CSSProperties;
  return (
    <Tag
      {...(as === 'button' ? { type: 'button' as const } : {})}
      title={title}
      aria-label={ariaLabel}
      className={cx('gkChip', className)}
      data-tone={tone}
      data-size={size}
      data-shape={shape}
      data-emphasis={emphasis}
      data-bordered={bordered ? '' : undefined}
      style={style}
    >
      {brand === undefined ? null : (
        <span className="gkChipBrand" style={{ color: `var(--g-provider-${brand})` }}>
          <AppBrandIcon brand={brand} size={BRAND_ICON_SIZE} />
        </span>
      )}
      {icon}
      {label === undefined ? null : <span className="gkChipLabel">{label}</span>}
      {trailing}
    </Tag>
  );
};
