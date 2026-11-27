import { useEffect, useState } from 'react';
import { LogPane } from '../../../../../../features/session/central/log/LogPane';
import { ShellFrame } from '../../shellChrome';
import { ATTN_NOISE_SESSION, seedAttnNoiseScene } from './attnNoiseSeed';

export const AttnNoiseScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedAttnNoiseScene();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame session={ATTN_NOISE_SESSION} main={<LogPane session={ATTN_NOISE_SESSION} />} />
  );
};
