import type { CSSProperties } from 'react';
import { cn } from '../../cn';
import { Tooltip } from '../Tooltip';
import type { TrailSegmentModel } from './types';
import { TRAIL_CRUMB_CLASS, TRAIL_CURRENT_CLASS, TRAIL_LINK_CLASS } from './trailClasses';
import { TrailLabel } from './TrailLabel';

type Props = {
  readonly segment: TrailSegmentModel;
  readonly isCurrent: boolean;
  readonly isIconOnly: boolean;
  readonly delayStyle?: CSSProperties;
};

export const TrailCrumb = ({ segment, isCurrent, isIconOnly, delayStyle }: Props) => {
  const Icon = segment.icon;
  const content = (
    <>
      {segment.glyph != null ? (
        <span aria-hidden className="flex shrink-0">
          {segment.glyph}
        </span>
      ) : (
        <Icon
          size={12}
          aria-hidden
          className={cn('shrink-0', segment.iconClassName ?? 'text-faint-foreground')}
        />
      )}
      <TrailLabel
        label={segment.label}
        isCurrent={isCurrent}
        isIconOnly={isIconOnly}
        {...(delayStyle !== undefined && { delayStyle })}
      />
      {isIconOnly || segment.accessory == null ? null : (
        <span className="flex shrink-0 items-center pl-1.5">{segment.accessory}</span>
      )}
    </>
  );

  if (segment.onSelect != null && !isCurrent) {
    const button = (
      <button
        type="button"
        onClick={segment.onSelect}
        aria-label={isIconOnly ? segment.label : undefined}
        className={cn(TRAIL_CRUMB_CLASS, TRAIL_LINK_CLASS)}
      >
        {content}
      </button>
    );
    return isIconOnly ? (
      <Tooltip content={segment.label} anchorClassName="flex shrink-0">
        {button}
      </Tooltip>
    ) : (
      button
    );
  }
  return (
    <span
      aria-label={isIconOnly ? segment.label : undefined}
      className={cn(TRAIL_CRUMB_CLASS, isCurrent ? TRAIL_CURRENT_CLASS : TRAIL_LINK_CLASS)}
    >
      {content}
    </span>
  );
};
