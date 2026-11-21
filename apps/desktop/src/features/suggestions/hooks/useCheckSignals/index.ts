import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { PrCheckConclusion, PrCheckRun, Session, SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { RETRY_NONE_AFTER_MS } from '../../../../store/slices/checks-log/RETRY_NONE_AFTER_MS';
import { failingChecksOf } from '../../../branch/checks/failingChecksOf';
import type { SuggestionCheckOutcome, SuggestionFailedCheck } from '../../deriveNextSteps';
import type { SignalCheckLog } from '../../nextStepSignals';
import { actionsJobOf } from '../../signals/actionsJobOf';

type Params = {
  readonly session: Session;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

type FailedRow = {
  readonly mountId: string;
  readonly prNumber: number;
  readonly check: PrCheckRun;
};

type OutcomeRow = {
  readonly mountId: string;
  readonly name: string;
  readonly conclusion: PrCheckConclusion;
};

type Facts = {
  readonly rows: ReadonlyArray<FailedRow>;
  readonly outcomes: ReadonlyArray<OutcomeRow>;
};

export type CheckSignals = {
  readonly failedChecks: Readonly<Record<string, ReadonlyArray<SuggestionFailedCheck>>>;
  readonly checks: Readonly<Record<string, ReadonlyArray<SuggestionCheckOutcome>>>;
  readonly checkLogs: ReadonlyArray<SignalCheckLog>;
};

const NO_CHECKS: ReadonlyArray<SuggestionFailedCheck> = [];

const NO_OUTCOMES: ReadonlyArray<SuggestionCheckOutcome> = [];

export const useCheckSignals = ({ session, mounts }: Params): CheckSignals => {
  const sessionId = session.id;
  const factsJson = useAppStore((state) => {
    const facts: { rows: FailedRow[]; outcomes: OutcomeRow[] } = { rows: [], outcomes: [] };
    for (const mount of mounts) {
      const prNumber = state.mountGithub[mount.mountId]?.pr?.number ?? null;
      if (prNumber === null) {
        continue;
      }
      const failing = failingChecksOf({ state, sessionId, mountId: mount.mountId, prNumber });
      for (const check of failing?.checks ?? []) {
        facts.rows.push({ mountId: mount.mountId, prNumber, check });
      }
      for (const check of failing?.allChecks ?? []) {
        facts.outcomes.push({
          mountId: mount.mountId,
          name: check.name,
          conclusion: check.conclusion,
        });
      }
    }
    return JSON.stringify(facts);
  });
  const { rows, outcomes } = useMemo((): Facts => JSON.parse(factsJson), [factsJson]);
  const failedChecks = useMemo(() => {
    const byMount: Record<string, SuggestionFailedCheck[]> = {};
    for (const row of rows) {
      byMount[row.mountId] = [
        ...(byMount[row.mountId] ?? NO_CHECKS),
        { name: row.check.name, detailsUrl: row.check.detailsUrl },
      ];
    }
    return byMount;
  }, [rows]);
  const checks = useMemo(() => {
    const byMount: Record<string, SuggestionCheckOutcome[]> = {};
    for (const outcome of outcomes) {
      byMount[outcome.mountId] = [
        ...(byMount[outcome.mountId] ?? NO_OUTCOMES),
        { name: outcome.name, conclusion: outcome.conclusion },
      ];
    }
    return byMount;
  }, [outcomes]);
  const urls = useMemo(
    () =>
      rows.flatMap((row) =>
        actionsJobOf({ detailsUrl: row.check.detailsUrl }) === null
          ? []
          : [row.check.detailsUrl ?? ''],
      ),
    [rows],
  );
  const readings = useAppStore(
    useShallow((state) => urls.map((url) => state.checkLogs[url] ?? null)),
  );
  const readCheckLog = useAppStore((state) => state.readCheckLog);
  const [retryTick, setRetryTick] = useState(0);
  useEffect(() => {
    const dueAt = readings.flatMap((reading) =>
      reading !== null && reading.status === 'none'
        ? [Date.parse(reading.fetchedAt) + RETRY_NONE_AFTER_MS + 1]
        : [],
    );
    if (dueAt.length === 0) {
      return;
    }
    const timer = setTimeout(
      () => setRetryTick((tick) => tick + 1),
      Math.max(Math.min(...dueAt) - Date.now(), 0),
    );
    return () => clearTimeout(timer);
  }, [readings]);
  useEffect(() => {
    for (const row of rows) {
      const mount = mounts.find((candidate) => candidate.mountId === row.mountId);
      if (mount === undefined || actionsJobOf({ detailsUrl: row.check.detailsUrl }) === null) {
        continue;
      }
      void readCheckLog({
        check: row.check,
        cwd: mount.worktreePath,
        workspaceId: session.workspaceId,
        projectId: mount.projectId,
      });
    }
  }, [mounts, readCheckLog, retryTick, rows, session.workspaceId]);
  const checkLogs = useMemo(
    () => readings.flatMap((reading) => (reading === null ? [] : [reading])),
    [readings],
  );
  return useMemo(() => ({ failedChecks, checks, checkLogs }), [checkLogs, checks, failedChecks]);
};
