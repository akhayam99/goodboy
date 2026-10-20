import { useEffect, useState } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { C07AutoFrame } from '../u25/c07/C07AutoFrame';
import { C08RunScene } from '../u25/C08RunScene';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly view: 'auto' | 'run' | 'transcript';
};

export const SpawnedPanelScene = ({ theme, view }: Props) => {
  const [isThemed, setIsThemed] = useState(false);
  useEffect(() => {
    applyDocumentTheme({ theme });
    setIsThemed(true);
  }, [theme]);
  if (!isThemed) {
    return null;
  }
  if (view === 'run') {
    return <C08RunScene state="working" selection="overview" />;
  }
  return (
    <C07AutoFrame
      seed={
        view === 'auto'
          ? { state: 'working', place: 'auto' }
          : { state: 'working', place: 'auto', pane: 'implementer' }
      }
    />
  );
};
