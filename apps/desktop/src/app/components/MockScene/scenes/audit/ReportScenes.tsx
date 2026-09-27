import { useEffect } from 'react';
import { ErrorBoundary, type ErrorReportRequest } from '@goodboy/ui';
import { CrashReport } from '../../../../../features/bug-report/components/CrashReport';
import {
  crashKind,
  crashPart,
  describeCrash,
} from '../../../../../features/bug-report/crashReport';
import { openReportSheet } from '../../../../../features/bug-report/openReportSheet';
import { useAppStore } from '../../../../../store';
import { sceneParam } from './sceneParams';

const OPEN_DELAY_MS = 400;

const NOTICE = {
  title: 'Retry failed, conversations left open',
  body: 'gh: HTTP 502 Bad Gateway for rowan@example.dev in /Users/rowan/code/core-api',
};

export const useReportSheetParam = (): void => {
  useEffect(() => {
    const report = sceneParam({ key: 'report' });
    if (report == null) {
      return;
    }
    if (sceneParam({ key: 'gh' }) === 'connected') {
      useAppStore.setState({
        githubStatus: { available: true, mode: 'gh-cli', user: 'rowan', scopes: [] },
      });
    }
    const timer = window.setTimeout(() => {
      openReportSheet(report === 'notice' ? { notice: NOTICE } : {});
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);
};

const Crash = (): null => {
  throw new Error(
    'fetch failed: Authorization: Bearer sk-ant-api03-AbCdEfGhIjKlMnOp at /Users/rowan/code/core-api/.env',
  );
};

const renderCrashReport = ({ error, componentStack }: ErrorReportRequest) => (
  <CrashReport
    heading="Report this crash"
    initialLine={`Crash: ${crashKind({ error })}`}
    errorPart={crashPart({ message: error.message, stack: error.stack, componentStack })}
  />
);

export const CrashReportScene = () => (
  <ErrorBoundary describeError={describeCrash} renderReport={renderCrashReport}>
    <Crash />
  </ErrorBoundary>
);
