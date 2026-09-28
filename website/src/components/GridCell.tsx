import type { CSSProperties } from 'react';
import type { FragmentFigure } from '../figures';
import { useTheme } from '../theme/theme';
import { Picture } from './Picture';

export type Cell = {
  readonly figure: FragmentFigure;
  readonly title: string;
  readonly text: string;
};

type Props = {
  readonly cell: Cell;
};

type WidthStyle = CSSProperties & {
  readonly '--w': string;
};

export const GridCell = ({ cell }: Props) => {
  const theme = useTheme();
  const style: WidthStyle = { '--w': `${cell.figure.displayWidth}px` };

  return (
    <li className="cell">
      <div
        className={cell.figure.isClosed === true ? 'cellMedia closed' : 'cellMedia'}
        style={style}
      >
        <Picture
          source={cell.figure.source}
          theme={theme}
          sizes={`${cell.figure.displayWidth}px`}
          alt={cell.figure.alt}
        />
      </div>
      <div>
        <h3 className="cellTitle">{cell.title}</h3>
        <p className="cellText">{cell.text}</p>
      </div>
    </li>
  );
};
