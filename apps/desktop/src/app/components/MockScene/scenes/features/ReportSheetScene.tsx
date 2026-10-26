import { useEffect } from 'react';
import { useAppStore } from '../../../../../store';
import { APP_VERSION } from '../../../../../shared/lib/appVersion';
import { BoardShellScene } from '../BoardShellScene';
import { useFakeTauri, type FakeHandlers } from '../brand/fakeTauri';

const HANDLERS: FakeHandlers = {
  'plugin:app|version': () => APP_VERSION,
  app_platform: () => ({ os: 'macos', osVersion: '15.5', arch: 'aarch64', buildSha: '3f9c2ab' }),
};

export const FeaturesReportSheetScene = () => {
  useFakeTauri({ handlers: HANDLERS, holdMs: 10000 });

  useEffect(() => {
    useAppStore.setState({
      githubStatus: { available: true, mode: 'gh-cli', scopes: [] },
    });
  }, []);

  return <BoardShellScene />;
};
