import { useEffect } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { BoardSelectedScene } from '../BoardSelectedScene';

type Props = {
  readonly theme: 'dark' | 'light';
};

export const BranchesBoardScene = ({ theme }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);
  return <BoardSelectedScene />;
};
