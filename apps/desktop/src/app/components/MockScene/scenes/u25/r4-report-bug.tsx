import { useEffect } from 'react';
import { APP_VERSION } from '../../../../../shared/lib/appVersion';
import { BoardShellScene } from '../BoardShellScene';
import { mockSceneIpc } from '../mockSceneIpc';

const CLICK_DELAY_MS = 250;

const PLATFORM = { os: 'macos', osVersion: '15.5', arch: 'aarch64', buildSha: '3f9c2ab' };

const BugReportBesideIconScene = () => {
  useEffect(() => {
    mockSceneIpc((command) => {
      if (command === 'plugin:app|version') {
        return APP_VERSION;
      }
      if (command === 'gh_status') {
        return { available: false, mode: 'absent', scopes: [] };
      }
      return command === 'app_platform' ? PLATFORM : null;
    });
  }, []);
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
