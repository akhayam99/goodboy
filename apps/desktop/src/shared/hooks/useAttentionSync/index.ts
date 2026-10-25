import { useEffect, useMemo, useRef } from 'react';
import { useAppStore, useCurrentWorkspace } from '../../../store';
import { useNowSessions } from '../useNowSessions';
import {
  announceAttention,
  listenAttention,
  type AttentionReport,
} from '../../lib/attentionChannel';
import { usePoll } from '../../lib/usePoll';

const ATTENTION_POLL_MS = 30_000;
const ATTENTION_ERROR_KEY = 'attention-sync';

type ReportParams = {
  readonly title: string;
  readonly error: unknown;
};

const reportOnce = ({ title, error }: ReportParams): void => {
  void useAppStore.getState().reportError({ title, error, coalesceKey: ATTENTION_ERROR_KEY });
};

export const useAttentionSync = (): void => {
  const { attention } = useNowSessions({});
  const workspaceId = useCurrentWorkspace()?.id ?? null;
  const { count, tone, reasons } = attention;
  const reasonKey = reasons.join('\n');
  const report = useMemo<AttentionReport | null>(
    () =>
      workspaceId === null
        ? null
        : { workspaceId, count, tone, reasonWords: reasonKey === '' ? [] : reasonKey.split('\n') },
    [workspaceId, count, tone, reasonKey],
  );
  const latestReport = useRef(report);
  latestReport.current = report;

  useEffect(() => {
    if (report === null) {
      return;
    }
    useAppStore.getState().setWindowAttention({ report });
    announceAttention({ report }).catch((error: unknown) =>
      reportOnce({ title: "Couldn't share this workspace's count with other windows", error }),
    );
  }, [report]);

  useEffect(() => {
    let off: () => void = () => undefined;
    let isLive = true;
    listenAttention({
      onReport: ({ report }) => useAppStore.getState().setWindowAttention({ report }),
    })
      .then((unlisten) => {
        if (!isLive) {
          unlisten();
          return;
        }
        off = unlisten;
      })
      .catch((error: unknown) =>
        reportOnce({ title: "Couldn't listen for other windows' counts", error }),
      );
    return () => {
      isLive = false;
      off();
    };
  }, []);

  usePoll({
    everyMs: ATTENTION_POLL_MS,
    run: () => {
      useAppStore
        .getState()
        .refreshWorkspaceAttention()
        .catch((error: unknown) =>
          reportOnce({ title: "Couldn't read the other workspaces' counts", error }),
        );
      const current = latestReport.current;
      if (current === null) {
        return;
      }
      announceAttention({ report: current }).catch((error: unknown) =>
        reportOnce({ title: "Couldn't share this workspace's count with other windows", error }),
      );
    },
  });
};
