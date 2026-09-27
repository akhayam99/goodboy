import './Shot.css';
import type { Figure, Pin } from '../figures';
import { delay, useInViewOnce } from './Reveal';

const PIN_STAGGER = 120;

type PinsProps = {
  readonly pins: readonly Pin[];
  readonly kind: 'd' | 'm';
};

const Pins = ({ pins, kind }: PinsProps) =>
  pins.map((pin) => (
    <span
      key={pin.n}
      className={`pin ${kind}`}
      style={{ left: `${pin.left}%`, top: `${pin.top}%`, ...delay((pin.n - 1) * PIN_STAGGER) }}
    >
      {pin.n}
    </span>
  ));

type Props = {
  readonly figure: Figure;
  readonly isEager?: boolean;
};

export const Shot = ({ figure, isEager = false }: Props) => {
  const { ref, inView } = useInViewOnce<HTMLElement>();
  const loading = isEager ? 'eager' : 'lazy';

  return (
    <figure className={inView ? 'shot in' : 'shot'} ref={ref}>
      <div className="window">
        <div className="imgbox dk">
          <img
            src={`/img/${figure.id}.webp`}
            width={figure.width}
            height={figure.height}
            alt={figure.alt}
            loading={loading}
          />
          <Pins pins={figure.pins} kind="d" />
        </div>
        <div className="imgbox mb">
          <img
            src={`/img/${figure.id}-m.webp`}
            width={figure.mobileWidth}
            height={figure.mobileHeight}
            alt={figure.alt}
            loading={loading}
          />
          <Pins pins={figure.mobilePins} kind="m" />
        </div>
      </div>
      <ol className="pincaps">
        {figure.captions.map((caption, index) => (
          <li key={caption.text} className={caption.isMobile ? undefined : 'nomob'}>
            <b>{index + 1}</b>
            <span>{caption.text}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
};
