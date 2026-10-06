import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@goodboy/types';
import { SessionSwitcher } from '../../../../../features/workspace/components/SessionSwitcher';
import { WorkspaceFrame } from '../audit/WorkspaceFrame';
import { seedSessionColumn } from './sessionColumnSeed';

type ScriptParams = {
  readonly isReady: boolean;
  readonly run: () => boolean;
};

const useScript = ({ isReady, run }: ScriptParams): void => {
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const interval = window.setInterval(() => {
      if (run()) {
        window.clearInterval(interval);
      }
    }, 120);
    return () => window.clearInterval(interval);
  }, [isReady, run]);
};

const clickOptions = (): boolean => {
  const trigger = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Options for sessions"]',
  );
  if (trigger === null) {
    return false;
  }
  if (trigger.getAttribute('aria-expanded') !== 'true') {
    trigger.click();
  }
  return true;
};

const hoverWebhookRow = (): boolean => {
  const row = [...document.querySelectorAll<HTMLButtonElement>('button[data-select-id]')].find(
    (candidate) => candidate.textContent?.includes('Fix webhook retries') === true,
  );
  if (row === undefined) {
    return false;
  }
  row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  return true;
};

const holdControlTab = (): boolean => {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { code: 'Tab', key: 'Tab', ctrlKey: true, bubbles: true }),
  );
  return true;
};

type SceneProps = {
  readonly isArchivedShown: boolean;
  readonly run: () => boolean;
  readonly extra?: ReactNode;
};

const SessionColumnScene = ({ isArchivedShown, run, extra }: SceneProps) => {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    setSession(seedSessionColumn({ isArchivedShown }));
  }, [isArchivedShown]);
  useScript({ isReady: session !== null, run });
  if (session === null) {
    return null;
  }
  return (
    <>
      <WorkspaceFrame session={session} />
      {extra}
    </>
  );
};

export const SessionsMenuScene = () => <SessionColumnScene isArchivedShown run={clickOptions} />;

export const SessionHoverScene = () => (
  <SessionColumnScene isArchivedShown={false} run={hoverWebhookRow} />
);

export const SessionSwitcherScene = () => (
  <SessionColumnScene isArchivedShown={false} run={holdControlTab} extra={<SessionSwitcher />} />
);
