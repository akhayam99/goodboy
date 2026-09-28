import './Shot.css';
import type { Figure } from '../figures';
import { Details } from './Details';
import { useInViewOnce } from './Reveal';

type Props = {
  readonly figure: Figure;
  readonly isEager?: boolean;
};

export const Shot = ({ figure, isEager = false }: Props) => {
  const { ref, inView } = useInViewOnce<HTMLElement>();

  return (
    <figure className={inView ? 'shot in' : 'shot'} ref={ref}>
      <div className="stage">
        <div className="win">
          <div className="winBar" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <img
            src={`/img/${figure.id}-1920.webp`}
            srcSet={`/img/${figure.id}-1920.webp 1920w, /img/${figure.id}.webp ${figure.width}w`}
            sizes="(max-width: 860px) 200vw, 1240px"
            width={figure.width}
            height={figure.height}
            alt={figure.alt}
            loading={isEager ? 'eager' : 'lazy'}
            fetchPriority={isEager ? 'high' : 'auto'}
          />
        </div>
      </div>
      {figure.details.length > 0 ? <Details details={figure.details} /> : null}
    </figure>
  );
};
