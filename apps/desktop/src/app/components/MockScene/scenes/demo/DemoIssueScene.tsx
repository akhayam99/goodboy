import { useEffect, useState } from 'react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { NewSessionBridge } from '../../../../../features/session/components/NewSessionBridge';
import { DemoIssueShell } from './DemoIssueShell';
import { seedDemoIssue } from './demoIssueSeed';

export const DemoIssueScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedDemoIssue();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <ToastProvider>
      <NewSessionBridge />
      <DemoIssueShell />
    </ToastProvider>
  );
};
