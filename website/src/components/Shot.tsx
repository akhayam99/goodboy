import './Shot.css';
import type { Figure } from '../figures';
import { Details } from './Details';
import { useInViewOnce } from './Reveal';
import { themedId } from './themedSrc';
import { useTheme } from '../theme/theme';

type Props = {
  readonly figure: Figure;
  readonly isEager?: boolean;
};

export const Shot = ({ figure, isEager = false }: Props) => {
  const { ref, inView } = useInViewOnce<HTMLDivElement>({ isEager });
  const id = themedId({ id: figure.id, theme: useTheme() });

  return (
    <figure className={inView ? 'shot in' : 'shot'}>
      <div className="stage">
        <div className="win" ref={ref}>
          <div className="winBar" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <img
            src={`/img/${id}.webp`}
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
