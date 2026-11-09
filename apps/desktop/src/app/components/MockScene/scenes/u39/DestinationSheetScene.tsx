import { useEffect, useState } from 'react';
import { seedFlowSession } from '../flow-audit/seeds';
import { DestinationSheet } from './DestinationSheet';

export const DestinationSheetScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedFlowSession();
    setIsReady(true);
  }, []);

  return isReady ? <DestinationSheet /> : null;
};
