import { useCallback, useEffect, useRef, useState } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import type { DemoTheme } from '../director/demoProtocol';
import { readDemoTheme } from '../readDemoTheme';
import { stripThemeParam } from '../stripThemeParam';
import { writeDemoTheme } from '../writeDemoTheme';

type ChooseParams = {
  readonly theme: DemoTheme;
};

type DemoThemeControls = {
  readonly theme: DemoTheme;
  readonly choose: (params: ChooseParams) => void;
  readonly toggle: () => void;
};

const initial = (): DemoTheme => readDemoTheme({ search: window.location.search });

export const useDemoTheme = (): DemoThemeControls => {
  const [theme, setTheme] = useState<DemoTheme>(initial);
  const latest = useRef(theme);

  useEffect(() => {
    stripThemeParam();
  }, []);

  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);

  const choose = useCallback(({ theme: next }: ChooseParams) => {
    if (latest.current === next) {
      return;
    }
    latest.current = next;
    writeDemoTheme({ theme: next });
    setTheme(next);
  }, []);

  const toggle = useCallback(() => {
    choose({ theme: latest.current === 'dark' ? 'light' : 'dark' });
  }, [choose]);

  return { theme, choose, toggle };
};
