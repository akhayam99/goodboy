import type { CheckReport } from '@goodboy/core';
import { scriptPinId } from '../../../features/scripts/scriptPinId';
import { startRunnableScript } from '../../../features/scripts/startRunnableScript';
import type { AppStore } from '../../store';
import type { RunCheckParams } from './ports';
import { resolveCheckScripts } from './resolveCheckScripts';

type Params = {
  readonly getState: () => AppStore;
  readonly params: RunCheckParams;
};

type Finished = Readonly<{ kind: 'exited'; exitCode: number }> | Readonly<{ kind: 'timed_out' }>;

type Settled = 'ended' | 'late';

const STOP_GRACE_MS = 30_000;

const stillRunning = new Set<string>();

type WaitParams = {
  readonly run: Promise<Readonly<{ exitCode: number }>>;
  readonly timeoutMs: number;
};

const waitFor = ({ run, timeoutMs }: WaitParams): Promise<Finished> =>
  new Promise<Finished>((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve({ kind: 'timed_out' });
    }, timeoutMs);
    run.then(
      (result) => {
        clearTimeout(timer);
        resolve({ kind: 'exited', exitCode: result.exitCode });
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

type EndedParams = {
  readonly run: Promise<unknown>;
};

const endedOf = ({ run }: EndedParams): Promise<Settled> =>
  run.then(
    (): Settled => 'ended',
    (): Settled => 'ended',
  );

type GraceParams = {
  readonly ms: number;
};

const graceOf = ({ ms }: GraceParams): Promise<Settled> =>
  new Promise<Settled>((resolve) => {
    setTimeout(() => resolve('late'), ms);
  });

type StopParams = {
  readonly run: Promise<unknown>;
  readonly worktreePath: string;
  readonly stop: () => Promise<void>;
  readonly onStopError: (error: unknown) => void;
};

const stopAndWait = async ({ run, worktreePath, stop, onStopError }: StopParams): Promise<void> => {
  await stop().catch(onStopError);
  const ended = endedOf({ run });
  if ((await Promise.race([ended, graceOf({ ms: STOP_GRACE_MS })])) === 'ended') {
    return;
  }
  stillRunning.add(worktreePath);
  void ended.then(() => stillRunning.delete(worktreePath));
};

export const runAutoCheckScript = async ({
  getState,
  params,
}: Params): Promise<CheckReport['status']> => {
  if (stillRunning.has(params.worktreePath)) {
    return 'unknown';
  }
  const resolved = await resolveCheckScripts({
    getState,
    sessionId: params.sessionId,
    mountId: params.mountId,
  });
  const script = resolved?.scripts.find((candidate) => scriptPinId(candidate) === params.check.id);
  if (resolved === null || script === undefined) {
    return 'unknown';
  }
  const scriptKey = script.savedId ?? script.key;
  try {
    const run = startRunnableScript({
      sessionId: params.sessionId,
      script,
      mountId: resolved.group.mountId,
      worktreePath: params.worktreePath,
    });
    const finished = await waitFor({ run, timeoutMs: params.timeoutMs });
    if (finished.kind === 'timed_out') {
      await stopAndWait({
        run,
        worktreePath: params.worktreePath,
        stop: () => getState().cancelScript(params.sessionId, scriptKey),
        onStopError: (error) => {
          void getState().reportError({ title: "Couldn't stop a check that ran too long", error });
        },
      });
      return 'timed_out';
    }
    if (finished.exitCode === 0) {
      return 'pass';
    }
    return finished.exitCode > 0 ? 'fail' : 'unknown';
  } catch {
    return 'unknown';
  }
};
