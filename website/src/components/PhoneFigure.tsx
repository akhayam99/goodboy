import './Phone.css';
import type { ReactNode } from 'react';
import type { PhoneShot } from '../figures';

type Props = {
  readonly shot?: PhoneShot;
  readonly caption?: string;
  readonly children?: ReactNode;
};

export const PhoneFigure = ({ shot, caption, children }: Props) => (
  <figure className="phoneFig">
    <div className="phoneStage">
      {shot === undefined
        ? children
        : shot.images.map((image, index) => (
            <img
              key={image.id}
              src={`/img/${image.id}.webp`}
              width={image.width}
              height={image.height}
              alt={index === 0 ? shot.alt : ''}
              loading="lazy"
            />
          ))}
    </div>
    <figcaption>{shot?.caption ?? caption}</figcaption>
  </figure>
);
