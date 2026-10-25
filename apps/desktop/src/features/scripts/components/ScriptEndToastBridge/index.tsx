import { useEffect } from 'react';
import { useToast } from '../../../../shared/components/Toast';
import { scriptEndedListener } from '../../scriptEndedListener';

export const ScriptEndToastBridge = () => {
  const { showToast } = useToast();

  useEffect(() => {
    const listener = scriptEndedListener({ showToast });
    window.addEventListener('goodboy:script-ended', listener);
    return () => window.removeEventListener('goodboy:script-ended', listener);
  }, [showToast]);

  return null;
};
