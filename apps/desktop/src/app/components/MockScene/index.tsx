import { UndoToastBridge } from '../UndoToastBridge';
import { useEffect } from 'react';
import { ToastProvider } from '../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../features/actions/components/ObjectMenuProvider';
import { finish as finishOnboarding } from '../../../features/onboarding/onboarding-store';
import { useBrandChrome } from './scenes/brand/brandChrome';
import { useHideSceneToasts } from './useHideSceneToasts';
import { applyDocumentTheme } from '../../../shared/lib/theme';
import { ReportSheetHost } from '../../../features/bug-report/components/ReportSheetHost';
import { useReportSheetParam } from './scenes/audit/ReportScenes';
import { MOCK_SCENES } from './registry';
import { UnknownScene } from './UnknownScene';

export { MOCK_SCENES } from './registry';

export const MockScene = () => {
  useReportSheetParam();
  useEffect(() => {
    document.getElementById('boot-shell')?.remove();
  }, []);

  const params = new URLSearchParams(window.location.search);
  const sceneName = params.get('scene') ?? 'workspace';
  const Scene = MOCK_SCENES[sceneName];

  if (params.get('brand') === '1') {
    finishOnboarding();
  }

  useHideSceneToasts();

  useBrandChrome({ isBrand: params.get('brand') === '1' });

  useEffect(() => {
    if (params.get('theme') !== 'light') {
      return;
    }
    applyDocumentTheme({ theme: 'light' });
  }, []);

  return (
    <ToastProvider>
      <UndoToastBridge />
      <ObjectMenuProvider>
        {Scene === undefined ? <UnknownScene sceneName={sceneName} /> : <Scene />}
        <ReportSheetHost />
      </ObjectMenuProvider>
    </ToastProvider>
  );
};
