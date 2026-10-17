import { useEffect } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { BoardShellScene } from '../BoardShellScene';

type Props = {
  readonly theme: 'dark' | 'light';
};

export const R4ColumnScene = ({ theme }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);
  return <BoardShellScene />;
};
