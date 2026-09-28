import type { CSSProperties } from 'react';
import type { Detail } from '../figures';
import { useTheme } from '../theme/theme';
import { themedId } from './themedSrc';

const MAX_TILE_WIDTH = 700;

const DETAIL_DENSITY = 3;

type TileStyle = CSSProperties & {
  readonly '--ar': number;
  readonly '--mw': string;
};

type Props = {
  readonly details: readonly Detail[];
};

const tileStyle = (detail: Detail): TileStyle => ({
  '--ar': detail.width / detail.height,
  '--mw': `${Math.min(detail.width / DETAIL_DENSITY, MAX_TILE_WIDTH)}px`,
});

export const Details = ({ details }: Props) => {
  const theme = useTheme();

  return (
    <ul className="details">
      {details.map((detail) => (
        <li key={detail.id} style={tileStyle(detail)}>
          <div className="detailFrame">
            <img
              src={`/img/${themedId({ id: detail.id, theme })}.webp`}
              width={detail.width}
              height={detail.height}
              alt=""
              loading="lazy"
            />
          </div>
          <p>{detail.caption}</p>
        </li>
      ))}
    </ul>
  );
};
