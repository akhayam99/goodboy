import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '../../cn';
import { ICON_SIZE } from '../../iconSize';
import { WORK_META_COLUMN } from './workMetaSpec';

const GLYPH_STEP = 8;
const GLYPH_CELL_MIN = 24;
const MAX_GLYPHS = 3;

type Props = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  readonly ref?: Ref<HTMLSpanElement>;
  readonly glyphs: ReadonlyArray<{ readonly key: string; readonly node: ReactNode }>;
  readonly name: string;
  readonly detail?: string | null;
  readonly isPlanned?: boolean;
  readonly layout?: 'column' | 'inline';
  readonly className?: string;
  readonly testId?: string;
};

export const ModelBlock = ({
  glyphs,
  name,
  detail = null,
  isPlanned = false,
  layout = 'column',
  className,
  testId,
  ref,
  ...rest
}: Props) => {
  const shown = glyphs.slice(0, MAX_GLYPHS);
  const spread = ICON_SIZE.control + Math.max(shown.length - 1, 0) * GLYPH_STEP;
  const cellWidth = Math.max(spread, GLYPH_CELL_MIN);
  const offset = (cellWidth - spread) / 2;
  const isInline = layout === 'inline';
  return (
    <span
      {...rest}
      ref={ref}
      data-meta-column="model"
      data-testid={testId}
      className={cn(
        isInline ? WORK_META_COLUMN.modelInline : WORK_META_COLUMN.model,
        isPlanned ? 'text-faint-foreground' : 'text-muted-foreground',
        className,
      )}
    >
      {shown.length === 0 ? null : (
        <span className={WORK_META_COLUMN.modelGlyph} style={{ width: cellWidth }}>
          {shown.map(({ key, node }, index) => (
            <span
              key={key}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: offset + index * GLYPH_STEP }}
            >
              {node}
            </span>
          ))}
        </span>
      )}
      {isInline ? (
        <span className={WORK_META_COLUMN.modelInlineLines}>
          <span data-routing-part="name" className="min-w-0 truncate text-meta">
            {name}
          </span>
          {detail === null || detail === '' ? null : (
            <>
              <span aria-hidden className="shrink-0 text-faint-foreground">
                ·
              </span>
              <span data-routing-part="detail" className="shrink-0 text-meta text-faint-foreground">
                {detail}
              </span>
            </>
          )}
        </span>
      ) : (
        <span className={WORK_META_COLUMN.modelLines}>
          <span data-routing-part="name" className={WORK_META_COLUMN.modelName}>
            {name}
          </span>
          {detail === null || detail === '' ? null : (
            <span data-routing-part="detail" className={WORK_META_COLUMN.modelDetail}>
              {detail}
            </span>
          )}
        </span>
      )}
    </span>
  );
};
