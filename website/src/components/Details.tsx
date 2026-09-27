import type { CSSProperties } from 'react';
import type { Detail } from '../figures';

type Props = {
  readonly details: readonly Detail[];
};

export const Details = ({ details }: Props) => (
  <ul className="details">
    {details.map((detail) => (
      <li
        key={detail.id}
        style={
          { '--ar': detail.width / detail.height, '--mw': `${detail.width / 2}px` } as CSSProperties
        }
      >
        <div className="detailFrame">
          <img
            src={`/img/${detail.id}.webp`}
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
