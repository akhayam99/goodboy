import type { DemoRect } from './demoProtocol';

const CHROME_SELECTOR = '[data-shell-rail], [data-tool-rail]';

type Params = {
  readonly root: Document;
};

export const chromeRectsOf = ({ root }: Params): ReadonlyArray<DemoRect> =>
  Array.from(root.querySelectorAll(CHROME_SELECTOR)).flatMap((element) => {
    const box = element.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) {
      return [];
    }
    return [
      {
        x: Math.round(box.left),
        y: Math.round(box.top),
        width: Math.round(box.width),
        height: Math.round(box.height),
      },
    ];
  });
