import { useEffect } from 'react';
import { NAMES } from '../../../../../shared/utils/names';
import { MountFixScene } from './MountFixScene';

type Props = {
  readonly theme: 'dark' | 'light';
};

const OPEN_DELAY_MS = 400;

export const MountsPickerScene = ({ theme }: Props) => {
  useEffect(() => {
    let timer = 0;
    const open = () => {
      const trigger = document.querySelector<HTMLButtonElement>(
        `[data-section-actions] button[aria-label="${NAMES.mountAProject}"]`,
      );
      if (trigger === null) {
        timer = window.setTimeout(open, OPEN_DELAY_MS);
        return;
      }
      trigger.click();
    };
    timer = window.setTimeout(open, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return <MountFixScene theme={theme} isConfirmOpen={false} />;
};
