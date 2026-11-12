import { useEffect, useState, type ReactNode } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly children: ReactNode;
};

export const ThemedScene = ({ theme, children }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    applyDocumentTheme({ theme });
    setIsReady(true);
  }, [theme]);
  if (!isReady) {
    return null;
  }
  return children;
};
