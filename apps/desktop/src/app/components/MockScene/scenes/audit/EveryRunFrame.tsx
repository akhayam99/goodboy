import { useEffect, useState } from 'react';
import { WorkflowStudio } from '../../../../../features/workflows/components/WorkflowStudio';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { useAppStore } from '../../../../../store';
import { SETTINGS_WORKSPACE, seedSettingsBase } from './settingsSeed';
import { installSettingsInvokeMocks } from './installSettingsInvokeMocks';

const noop = () => undefined;

type Props = {
  readonly seed?: () => void;
};

export const EveryRunFrame = ({ seed = noop }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    installSettingsInvokeMocks();
    seedSettingsBase();
    seed();
    useAppStore.setState({
      workflowStudioView: 'every',
      loadPhaseTemplates: async () => undefined,
      loadStepLibrary: async () => undefined,
    });
    setIsReady(true);
  }, [seed]);
  if (!isReady) {
    return null;
  }
  return (
    <ToastProvider>
      <WorkflowStudio workspaceId={SETTINGS_WORKSPACE.id} onClose={noop} />
    </ToastProvider>
  );
};
