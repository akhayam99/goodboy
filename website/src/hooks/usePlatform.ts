import { useEffect, useState } from 'react';

export type Platform = 'mac' | 'linux' | 'other';

type NavigatorWithData = Navigator & {
  readonly userAgentData?: { readonly platform?: string };
};

const detectPlatform = (): Platform => {
  const nav = navigator as NavigatorWithData;
  const hint = nav.userAgentData?.platform;
  const source = hint === undefined || hint === '' ? nav.userAgent : hint;
  if (/iphone|ipad|ipod|android|windows|cros/i.test(source)) {
    return 'other';
  }
  if (/mac/i.test(source)) {
    return 'mac';
  }
  if (/linux|x11/i.test(source)) {
    return 'linux';
  }
  return 'other';
};

export const usePlatform = (): Platform => {
  const [platform, setPlatform] = useState<Platform>('other');

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return platform;
};
