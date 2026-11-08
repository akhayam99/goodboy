import { useEffect, type ComponentType } from 'react';

const SETTLE_MS = 900;
const READING_DELTA_PX = 360;
const START_MS = 120;

type Scroller = 'first' | 'last';

type Start = 'here' | 'top';

type Props = {
  readonly Base: ComponentType;
  readonly scroller?: Scroller;
  readonly start?: Start;
};

type FindParams = {
  readonly scroller: Scroller;
};

type ReadParams = {
  readonly viewport: HTMLElement;
};

const isScrollable = ({ viewport }: ReadParams): boolean =>
  viewport.scrollHeight > viewport.clientHeight;

const viewportOf = ({ scroller }: FindParams): HTMLElement | undefined => {
  const viewports = [...document.querySelectorAll<HTMLElement>('[data-page-scroller]')].filter(
    (viewport) => isScrollable({ viewport }),
  );
  return scroller === 'first' ? viewports[0] : viewports[viewports.length - 1];
};

const readDown = ({ viewport }: ReadParams): void => {
  viewport.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: READING_DELTA_PX }));
  viewport.scrollTop = viewport.scrollTop + READING_DELTA_PX;
};

export const ReadingScene = ({ Base, scroller = 'first', start = 'here' }: Props) => {
  useEffect(() => {
    let read: number | null = null;
    const settle = window.setTimeout(() => {
      const viewport = viewportOf({ scroller });
      if (viewport === undefined) {
        return;
      }
      if (start === 'top') {
        viewport.scrollTop = 0;
      }
      read = window.setTimeout(() => readDown({ viewport }), START_MS);
    }, SETTLE_MS);
    return () => {
      window.clearTimeout(settle);
      if (read !== null) {
        window.clearTimeout(read);
      }
    };
  }, [scroller, start]);

  return <Base />;
};
