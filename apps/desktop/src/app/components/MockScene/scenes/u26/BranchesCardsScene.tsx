import { useEffect } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { R4RailScene } from '../u25/r4RailScene';

type Props = {
  readonly theme: 'dark' | 'light';
};

export const BranchesCardsScene = ({ theme }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);
  return <R4RailScene state="session" />;
};
