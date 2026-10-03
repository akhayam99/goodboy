import { useEffect } from 'react';
import { useAppStore } from '../../../../../store';
import { CTX_PAYMENTS_MOUNT_ID } from './contextBase';
import { HistorySceneShell } from './HistorySceneShell';
import {
  SQUASH_APPLIED_DRAFT,
  SQUASH_APPLIED_RUN,
  SQUASH_PLANNED_DRAFT,
} from './historySquashSeed';

const APPLY_AFTER_MS = 1500;

export const BrandHistorySquashScene = () => {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('phase') === 'planned') {
      return;
    }
    const timer = window.setTimeout(() => {
      useAppStore.setState({
        historyDrafts: { [CTX_PAYMENTS_MOUNT_ID]: SQUASH_APPLIED_DRAFT },
        historyRuns: { [CTX_PAYMENTS_MOUNT_ID]: SQUASH_APPLIED_RUN },
      });
    }, APPLY_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <HistorySceneShell draft={SQUASH_PLANNED_DRAFT} run={null} github={null} isLedger={false} />
  );
};
