import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../store';
import { seedFlowSession } from '../flow-audit/seeds';
import { DestinationSheet } from './DestinationSheet';

export const DestinationSheetScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedFlowSession();
    useAppStore.setState({
      loadWorkLeads: async () => undefined,
    });
    setIsReady(true);
  }, []);

  return isReady ? <DestinationSheet /> : null;
};
