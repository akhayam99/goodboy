import './Frame.css';
import type { CSSProperties, ReactNode } from 'react';
import type { FrameFigure } from '../figures';
import { useTheme } from '../theme/theme';
import { Picture } from './Picture';

type Props = {
  readonly figure: FrameFigure;
  readonly cap?: number;
  readonly isEager?: boolean;
  readonly children?: ReactNode;
};

type CapStyle = CSSProperties & {
  readonly '--cap': string;
};

const VIEW_WIDTH = 1250;
const SIZES = '(max-width: 600px) calc(100vw - 54px), min(1250px, calc(100vw - 70px))';

export const Frame = ({ figure, cap = 600, isEager = false, children }: Props) => {
  const theme = useTheme();
  const isCapped = (VIEW_WIDTH * figure.source.height) / figure.source.width > cap;
  const style: CapStyle = { '--cap': `${cap}px` };

  return (
    <div className="frameBlock">
      <div
        className={isCapped ? 'frame capped' : 'frame'}
        style={style}
        data-reveal={isEager ? undefined : ''}
      >
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
      </div>
      {children === undefined ? null : (
        <div className="frameNote" data-reveal="">
          {children}
        </div>
      )}
    </div>
  );
};
