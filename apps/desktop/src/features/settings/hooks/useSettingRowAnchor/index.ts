import { useContext, useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';
import { canAnimate } from '@goodboy/ui';
import { SettingRowFocusContext } from '../../settingRowFocusContext';

const SETTING_ROW_HIGHLIGHT_MS = 1600;

type Params = {
  readonly rowKey: string;
};

type SettingRowAnchor = {
  readonly ref: RefObject<HTMLDivElement | null>;
  readonly isHighlighted: boolean;
};

export const useSettingRowAnchor = ({ rowKey }: Params): SettingRowAnchor => {
  const { row, onShown } = useContext(SettingRowFocusContext);
  const ref = useRef<HTMLDivElement | null>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const isTarget = row === rowKey;

  const show = useEffectEvent(() => {
    ref.current?.scrollIntoView({
      block: 'center',
      behavior: canAnimate({ element: ref.current }) ? 'smooth' : 'auto',
    });
    setIsHighlighted(true);
    onShown();
  });

  useEffect(() => {
    if (isTarget) {
      show();
    }
  }, [isTarget]);

  useEffect(() => {
    if (!isHighlighted) {
      return undefined;
    }
    const timer = window.setTimeout(() => setIsHighlighted(false), SETTING_ROW_HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [isHighlighted]);

  return { ref, isHighlighted };
};
