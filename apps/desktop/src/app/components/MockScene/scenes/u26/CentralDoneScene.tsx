import { useEffect, useState } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { CentralDoneColumn } from './CentralDoneColumn';
import { CentralDoneDrawer } from './CentralDoneDrawer';
import {
  DONE_BATCH_ROW_ID,
  DONE_CHAIN_ROW_ID,
  DONE_SESSION_ID,
  seedCentralDone,
  seedCentralDoneBatch,
  seedCentralDoneRecap,
} from './centralDoneSeed';

export type CentralDoneMoment = 'mid' | 'open' | 'log' | 'batch' | 'recap';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly moment: CentralDoneMoment;
  readonly search?: string;
};

const OPEN_ROW = 'run:mock-done-run-build';
const FOCUS_ENTRY = 'agent:mock-done-agent-scribe';

export const CentralDoneScene = ({ theme, moment, search }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedCentralDone();
    if (moment === 'batch') {
      seedCentralDoneBatch();
    }
    if (moment === 'recap') {
      seedCentralDoneRecap();
    }
    if (moment === 'log') {
      useAppStore.getState().openDrawer({
        kind: 'session-log',
        sessionId: DONE_SESSION_ID,
        payload: { focusEntryId: FOCUS_ENTRY },
      });
    }
    setIsReady(true);
  }, [theme, moment]);
  useEffect(() => {
    if (!isReady || search === undefined) {
      return;
    }
    const field = document.querySelector<HTMLInputElement>('input[type="search"]');
    if (field === null) {
      return;
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(field, search);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }, [isReady, search]);
  if (!isReady) {
    return null;
  }
  if (moment === 'log') {
    return <CentralDoneDrawer />;
  }
  return (
    <div data-shot>
      <CentralDoneColumn initialOpenId={openIdOf({ moment })} />
    </div>
  );
};

const openDay = (): string => new Date(2026, 9, 18).toDateString();

type MomentParams = {
  readonly moment: CentralDoneMoment;
};

const openIdOf = ({ moment }: MomentParams): string | null => {
  if (moment === 'open') {
    return `${OPEN_ROW}:${openDay()}`;
  }
  if (moment === 'recap') {
    return DONE_CHAIN_ROW_ID;
  }
  return moment === 'batch' ? DONE_BATCH_ROW_ID : null;
};
