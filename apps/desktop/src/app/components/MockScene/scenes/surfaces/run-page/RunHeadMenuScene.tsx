import { useEffect } from 'react';
import { LEAD_LEVEL_COPY } from '../../../../../../features/auto/permissions/leadLevelCopy';
import { RunPageScene } from './RunPageScene';

type Props = {
  readonly theme: 'dark' | 'light';
};

const TRY_EVERY_MS = 100;

export const RunHeadMenuScene = ({ theme }: Props) => {
  useEffect(() => {
    const timer = setInterval(() => {
      const fact = document.querySelector<HTMLButtonElement>(
        `button[data-setting-chip="${LEAD_LEVEL_COPY.menu}"]`,
      );
      if (fact === null || fact.disabled) {
        return;
      }
      clearInterval(timer);
      fact.click();
    }, TRY_EVERY_MS);
    return () => clearInterval(timer);
  }, [theme]);
  return <RunPageScene state="working" theme={theme} isLead />;
};
