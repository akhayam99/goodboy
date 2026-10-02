import type { CSSProperties, ReactNode } from 'react';
import './kit.css';
import { AppBrandIcon, CircleHelp, FolderTree, type AppBrandId } from '../icons';
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

type RepoChipProps = {
  readonly name: string;
  readonly className?: string;
};

export const RepoChip = ({ name, className }: RepoChipProps) => (
  <Chip
    tone="neutral"
    size="xs"
    bordered={false}
    label={name}
    className={cx('gkRepo', className)}
  />
);

type StartsInChipProps = {
  readonly target: string;
  readonly verb?: string;
  readonly className?: string;
};

export const StartsInChip = ({ target, verb = 'Starts in', className }: StartsInChipProps) => (
  <Chip
    tone="neutral"
    size="xs"
    bordered={false}
    icon={<FolderTree size={12} />}
    label={
      <>
        <span className="gkMuted">{verb}</span> <span className="gkFg">{target}</span>
      </>
    }
    className={className}
  />
);

type NeedsYouChipProps = {
  readonly count: number;
  readonly className?: string;
};

export const NeedsYouChip = ({ count, className }: NeedsYouChipProps) => (
  <Chip
    tone="neutral"
    size="control"
    emphasis="subtle"
    icon={<CircleHelp size={12} />}
    label={`${count} ${count === 1 ? 'needs' : 'need'} you`}
    className={className}
  />
);
