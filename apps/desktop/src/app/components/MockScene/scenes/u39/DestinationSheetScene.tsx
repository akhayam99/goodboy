import { useEffect, useState } from 'react';
import { SETTING_WORK_ENABLED } from '../../../../../shared/lib/workSetting';
import { useAppStore } from '../../../../../store';
import { seedFlowSession } from '../flow-audit/seeds';
import { DestinationSheet } from './DestinationSheet';

export const DestinationSheetScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedFlowSession();
    useAppStore.setState({
      settings: { ...useAppStore.getState().settings, [SETTING_WORK_ENABLED]: 'true' },
      loadWorkLeads: async () => undefined,
    });
    setIsReady(true);
  }, []);

  return isReady ? <DestinationSheet /> : null;
};
