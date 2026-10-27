import { useCallback, useEffect, useRef } from 'react';
import { useToast } from '../../../shared/components/Toast';
import { offerLastCrash } from '../offerLastCrash';
import { useWindowHeartbeat } from '../hooks/useWindowHeartbeat';

export const LastCrashBridge = () => {
  const { showToast } = useToast();
  const isMounted = useRef(true);

  const offer = useCallback(() => {
    void offerLastCrash({ showToast, isActive: () => isMounted.current });
  }, [showToast]);

  useEffect(() => {
    isMounted.current = true;
    offer();
    return () => {
      isMounted.current = false;
    };
  }, [offer]);

  useWindowHeartbeat({ onResumed: offer });

  return null;
};
