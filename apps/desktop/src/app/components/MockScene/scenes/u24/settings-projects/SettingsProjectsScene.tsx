import { useEffect } from 'react';
import { SettingsFrame } from '../../audit/SettingsFrame';
import { SETTINGS_PROJECTS_SEEDS, type SettingsProjectsVariant } from './settingsProjectsSeed';

const FOCUS = { scope: 'workspace', section: 'projects' } as const;

const OPENED_ROW = 'Edit ledger-core';

const OPEN_POLL_MS = 50;

type Props = {
  readonly variant: SettingsProjectsVariant;
};

export const SettingsProjectsScene = ({ variant }: Props) => {
  const isOpen = variant === 'open' || variant === 'failed';

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const timer = window.setInterval(() => {
      const toggle = document.querySelector<HTMLElement>(`[aria-label="${OPENED_ROW}"]`);
      if (toggle === null) {
        return;
      }
      toggle.click();
      window.clearInterval(timer);
    }, OPEN_POLL_MS);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  return <SettingsFrame focus={FOCUS} seed={SETTINGS_PROJECTS_SEEDS[variant]} />;
};
