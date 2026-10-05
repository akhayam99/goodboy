import { Button, Notice } from '@goodboy/ui';
import type { HistoryRun } from '../../../../store/slices/history/types';
import { HistoryRunStatus } from './HistoryRunStatus';
import type { useHistoryRunFlow } from './useHistoryRunFlow';

type Props = {
  readonly run: HistoryRun;
  readonly flow: NonNullable<ReturnType<typeof useHistoryRunFlow>>;
  readonly titleOf: (sha: string) => string;
  readonly hasUpstream: boolean;
};

export const HistoryStatusSlot = ({ run, flow, titleOf, hasUpstream }: Props) =>
  run.phase === 'restored' ? (
    <Notice
      tone="info"
      placement="inline"
      title="Restored the previous history"
      body="The history you left is kept as a backup too."
      actions={
        <Button size="sm" variant="ghost" onClick={flow.dismiss}>
          Dismiss
        </Button>
      }
    />
  ) : (
    <HistoryRunStatus
      run={run}
      titleOf={titleOf}
      hasUpstream={hasUpstream}
      onRewriteWithAgent={flow.rewriteWithAgent}
      onApplyRewritten={flow.applyRewritten}
      onDismiss={flow.dismiss}
      onRefresh={flow.refresh}
    />
  );
