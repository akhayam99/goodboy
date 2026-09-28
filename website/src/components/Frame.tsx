import './Frame.css';
import type { CSSProperties, ReactNode } from 'react';
import type { FrameFigure } from '../figures';
import { useTheme } from '../theme/theme';
import { Picture } from './Picture';

type Props = {
  readonly figure: FrameFigure;
  readonly cap?: number;
  readonly isEager?: boolean;
  readonly isCanvas?: boolean;
  readonly children?: ReactNode;
};

type CapStyle = CSSProperties & {
  readonly '--cap': string;
};

const VIEW_WIDTH = 1144;
const SIZES =
  '(max-width: 860px) calc(100vw - 24px), (max-width: 1100px) calc(100vw - 128px), min(1144px, calc(100vw - 176px))';

export const Frame = ({
  figure,
  cap = 600,
  isEager = false,
  isCanvas = false,
  children,
}: Props) => {
  const theme = useTheme();
  const isCapped = !isCanvas && (VIEW_WIDTH * figure.source.height) / figure.source.width > cap;
  const style: CapStyle = { '--cap': `${cap}px` };
  const className = ['frame', isCapped ? 'capped' : null, isCanvas ? 'canvas' : null]
    .filter(Boolean)
    .join(' ');
  const picture = (
    <div className="view">
      <Picture
        source={figure.source}
        phone={figure.phone}
        theme={theme}
        sizes={SIZES}
        alt={figure.alt}
        isEager={isEager}
      />
    </div>
  );

  return (
    <div className="frameBlock">
      <div className={className} style={style} data-reveal={isEager ? undefined : ''}>
        {isCanvas ? (
          <div className="canvasShade" data-shadow-exception="">
            {picture}
          </div>
        ) : (
          picture
        )}
      </div>
      {children === undefined ? null : (
        <div className="frameNote" data-reveal="">
          {children}
        </div>
      )}
    </div>
  );
};
