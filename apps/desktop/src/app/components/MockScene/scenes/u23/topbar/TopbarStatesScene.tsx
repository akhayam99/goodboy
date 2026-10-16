import { useEffect, type ComponentType } from 'react';
import { sceneParam } from '../../audit/sceneParams';
import { seedTopbarLimits, seedTopbarBell } from './topbarSeed';

type Props = {
  readonly Inner: ComponentType;
  readonly providerCount: number;
  readonly width?: number;
};

const FRAME_KEY = 'frame';

const framedSourceOf = (): string | null => {
  if (sceneParam({ key: 'scene' }) === null || sceneParam({ key: FRAME_KEY }) === '1') {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  params.set(FRAME_KEY, '1');
  return `${window.location.pathname}?${params.toString()}`;
};

export const TopbarStatesScene = ({ Inner, providerCount, width }: Props) => {
  useEffect(() => {
    seedTopbarLimits({ count: providerCount });
    seedTopbarBell();
  }, [providerCount]);

  if (width === undefined) {
    return <Inner />;
  }
  const source = framedSourceOf();
  if (source !== null) {
    return (
      <iframe
        title={`Window ${width} wide`}
        src={source}
        className="block h-screen border-0"
        style={{ width }}
      />
    );
  }
  return (
    <div className="relative h-screen overflow-hidden" style={{ width }}>
      <Inner />
    </div>
  );
};
