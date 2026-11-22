import { useEffect } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { ActivityRunScene } from '../ActivityRunScene';
import { SESSION_ID } from '../activityRunSeed';

type Props = {
  readonly theme: 'dark' | 'light';
};

const LIVE_TURN_ID = 'mock-run-telemetry-console';
const LIVE_CONTEXT_TOKENS = 412_600;

const reportLiveContext = () =>
  useAppStore.setState((state) => ({
    sessionTelemetry: {
      ...state.sessionTelemetry,
      [SESSION_ID]: (state.sessionTelemetry[SESSION_ID] ?? []).map((record) =>
        record.id === LIVE_TURN_ID ? { ...record, contextTokens: LIVE_CONTEXT_TOKENS } : record,
      ),
    },
  }));

export const ContextViewScene = ({ theme }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);
  return <ActivityRunScene contextSection="summary" onSeeded={reportLiveContext} />;
};
