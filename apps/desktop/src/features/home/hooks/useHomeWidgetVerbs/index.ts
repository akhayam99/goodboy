import { useEffect, useRef } from 'react';
import type { HomeWidgetVerbDetail } from '../../../../shared/lib/dispatchWindowEvent/windowEvents';
import { homeWidgetIdOf } from '../../layout/homeWidgetIdOf';
import type { WidgetGesture } from '../../layout/layoutTypes';

type Params = {
  readonly isEnabled: boolean;
  readonly onHide: (params: WidgetGesture) => void;
  readonly onShow: (params: WidgetGesture) => void;
};

const VERB_EVENT = 'goodboy:home-widget-verb';

export const useHomeWidgetVerbs = ({ isEnabled, onHide, onShow }: Params): void => {
  const handlersRef = useRef({ onHide, onShow });
  handlersRef.current = { onHide, onShow };
  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    const controller = new AbortController();
    window.addEventListener(
      VERB_EVENT,
      (event) => {
        if (!(event instanceof CustomEvent)) {
          return;
        }
        const detail: HomeWidgetVerbDetail = event.detail;
        const run =
          detail.verb === 'hide' ? handlersRef.current.onHide : handlersRef.current.onShow;
        const id = homeWidgetIdOf({ value: detail.id });
        if (id === null) {
          return;
        }
        run({ id });
      },
      { signal: controller.signal },
    );
    return () => controller.abort();
  }, [isEnabled]);
};
