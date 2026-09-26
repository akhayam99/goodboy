import { useEffect, useState, type ReactNode } from 'react';
import { ScrollerStyleContext, type ScrollerStyle } from '@goodboy/ui';
import { systemScrollerStyle } from '../../lib/scrollerStyle';

type Props = {
  readonly children: ReactNode;
};

export const ScrollerStyleProvider = ({ children }: Props) => {
  const [style, setStyle] = useState<ScrollerStyle>('hover');

  useEffect(() => {
    let cancelled = false;
    const resolve = () => {
      void systemScrollerStyle().then((next) => {
        if (!cancelled) {
          setStyle(next);
        }
      });
    };
    resolve();
    window.addEventListener('focus', resolve);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', resolve);
    };
  }, []);

  return <ScrollerStyleContext.Provider value={style}>{children}</ScrollerStyleContext.Provider>;
};
