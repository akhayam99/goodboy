type Params = {
  readonly container: HTMLElement;
  readonly onFit: () => void;
};

type ArmParams = {
  readonly listener: () => void;
};

type Watch = {
  query: MediaQueryList | null;
  frame: number;
};

export const watchTerminalFit = ({ container, onFit }: Params): (() => void) => {
  const watch: Watch = { query: null, frame: 0 };
  const resize = new ResizeObserver(() => onFit());
  resize.observe(container);
  const arm = ({ listener }: ArmParams): void => {
    watch.query?.removeEventListener('change', listener);
    if (typeof window.matchMedia !== 'function') {
      watch.query = null;
      return;
    }
    watch.query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    watch.query.addEventListener('change', listener);
  };
  const refit = (): void => {
    window.cancelAnimationFrame(watch.frame);
    watch.frame = window.requestAnimationFrame(() => {
      watch.frame = 0;
      onFit();
    });
    arm({ listener: refit });
  };
  arm({ listener: refit });
  return () => {
    resize.disconnect();
    window.cancelAnimationFrame(watch.frame);
    watch.query?.removeEventListener('change', refit);
    watch.query = null;
  };
};
