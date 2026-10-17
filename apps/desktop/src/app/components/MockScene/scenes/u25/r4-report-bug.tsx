import { useEffect } from 'react';
import { BoardShellScene } from '../BoardShellScene';

const CLICK_DELAY_MS = 250;

const BugReportBesideIconScene = () => {
  useEffect(() => {
    const timer = window.setInterval(() => {
      const trigger = document.querySelector<HTMLElement>('[data-report-bug]');
      if (trigger === null) {
        return;
      }
      trigger.click();
      window.clearInterval(timer);
    }, CLICK_DELAY_MS);
    return () => window.clearInterval(timer);
  }, []);
  return <BoardShellScene />;
};

export const U25_R4_REPORT_SCENES = {
  'r4-report-bug': BugReportBesideIconScene,
};
