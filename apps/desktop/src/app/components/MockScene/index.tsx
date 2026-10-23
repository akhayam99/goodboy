import { UndoToastBridge } from '../UndoToastBridge';
import { useEffect } from 'react';
import { ToastProvider } from '../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../features/actions/components/ObjectMenuProvider';
import { finish as finishOnboarding } from '../../../features/onboarding/onboarding-store';
import { useBrandChrome } from './scenes/brand/brandChrome';
import { useHideSceneToasts } from './useHideSceneToasts';
import { useBackdropParam } from './useBackdropParam';
import { applyDocumentTheme } from '../../../shared/lib/theme';
import { ReportSheetHost } from '../../../features/bug-report/components/ReportSheetHost';
import { useReportSheetParam } from './scenes/audit/ReportScenes';
import { MOCK_SCENES } from './registry';
import { UnknownScene } from './UnknownScene';
import { quietSceneRepoCheck } from './scenes/quietSceneRepoCheck';
import { DemoDirector } from './demo/DemoDirector';
import { installDemoIpc } from './demo/director/installDemoIpc';

export { MOCK_SCENES } from './registry';

quietSceneRepoCheck();

const DEFAULT_SCENE = import.meta.env.MODE === 'demo' ? 'demo' : 'workspace';

export const MockScene = () => {
  useReportSheetParam();
  useEffect(() => {
    document.getElementById('boot-shell')?.remove();
  }, []);

  const params = new URLSearchParams(window.location.search);
  const sceneName = params.get('scene') ?? DEFAULT_SCENE;
  const Scene = MOCK_SCENES[sceneName];

  if (params.has('director')) {
    installDemoIpc();
  }

  if (params.get('brand') === '1') {
    finishOnboarding();
  }

  useHideSceneToasts();

  useBackdropParam();

  useBrandChrome({ isBrand: params.get('brand') === '1' });

  useEffect(() => {
    const theme = params.get('theme');
    if (theme !== 'light' && theme !== 'dark') {
      return;
    }
    applyDocumentTheme({ theme });
  }, []);

  return (
    <ToastProvider>
      <UndoToastBridge />
      <ObjectMenuProvider>
        {Scene === undefined ? <UnknownScene sceneName={sceneName} /> : <Scene />}
        {params.has('director') ? <DemoDirector sceneName={sceneName} /> : null}
        <ReportSheetHost />
      </ObjectMenuProvider>
    </ToastProvider>
  );
};
