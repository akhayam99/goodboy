import { isTypingTarget } from '../../../../../shared/keyboard/isTypingTarget';

type Params = {
  readonly view: Window;
  readonly signal: AbortSignal;
};

const FORWARDED_KEYS: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowRight', 'h', 'H']);

export const forwardDemoKeys = ({ view, signal }: Params): void => {
  view.addEventListener(
    'keydown',
    (event) => {
      const host = view.frameElement;
      if (
        host === null ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        !FORWARDED_KEYS.has(event.key) ||
        isTypingTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      const Forwarded = host.ownerDocument.defaultView?.KeyboardEvent ?? KeyboardEvent;
      host.dispatchEvent(
        new Forwarded('keydown', {
          key: event.key,
          code: event.code,
          shiftKey: event.shiftKey,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    { signal },
  );
};
