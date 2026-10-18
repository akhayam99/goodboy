import { useMemo } from 'react';
import type { ProviderRunId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { autoChildLabelsOf } from '../../../auto/autoChildLabelsOf';
import { useAutoTreeActions } from '../../../auto/chat/useAutoTreeActions';
import { AutoResultCards } from './AutoResultCards';

type Props = {
  readonly sessionId: SessionId;
  readonly runId: ProviderRunId;
};

export const AutoDeliveryResults = ({ sessionId, runId }: Props) => {
  const views = useAppStore((state) => state.autoTreeViews[sessionId] ?? EMPTY_ARRAY);
  const { openChild } = useAutoTreeActions({ sessionId });
  const delivered = useMemo(() => {
    for (const view of views) {
      const results = view.deliveredResults.filter((result) => result.runId === runId);
      if (results.length > 0) {
        return { results, labels: autoChildLabelsOf({ delegations: view.delegations }) };
      }
    }
    return null;
  }, [views, runId]);
  if (delivered === null) {
    return null;
  }
  return (
    <AutoResultCards
      results={delivered.results}
      labels={delivered.labels}
      onOpenChild={openChild}
    />
  );
};
