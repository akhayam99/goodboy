import { useEffect, useMemo, useRef, useState } from 'react';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import { usePoll } from '../../../../../shared/lib/usePoll';
import { useAppStore, useSessions } from '../../../../../store';
import { WATCH } from './WATCH';
import { branchSignatureOf } from './branchSignatureOf';
import { changedBranchSessions } from './changedBranchSessions';
import { factKeyOf } from './factKeyOf';
import { failedChecksSince } from './failedChecksSince';
import { parseBranchSignature } from './parseBranchSignature';
import { parseWatchSignature } from './parseWatchSignature';
import { readFailedOf } from './readFailedOf';
import { rerunNotes } from '../../rerunNotes';
import { wakeCandidatesOf } from './wakeCandidatesOf';
import { wakeOnFailure } from './wakeOnFailure';
import { watchSignatureOf } from './watchSignatureOf';
import { watchedMountIdsOf } from './watchedMountIdsOf';
import { watchedFactsOf } from './watchedFactsOf';
import type { WatchFact } from './watchFacts';

export const useGithubPolling = (): void => {
  const sweepRequests = useAppStore((s) => s.sweepRequests);
  const githubAvailable = useAppStore((s) => s.githubStatus?.available ?? false);
  const hostBindingSignature = useAppStore((s) =>
    Object.values(s.workspaceIntegrations)
      .flat()
      .filter((binding) => binding.provider === 'gitlab' || binding.provider === 'bitbucket')
      .map((binding) => binding.id)
      .join(';'),
  );
  const sessions = useSessions();
  const branchSignature = useAppStore((s) =>
    branchSignatureOf({ sessions, branches: s.sessionBranches }),
  );
  const watchSignature = useAppStore((s) => watchSignatureOf({ state: s }));
  const [rerunSignature, setRerunSignature] = useState(rerunNotes.snapshot);
  const knownBranches = useRef<ReadonlyMap<SessionId, string> | null>(null);
  const knownFacts = useRef<ReadonlyMap<string, WatchFact> | null>(null);
  const wakes = useRef(new Map<string, number>());
  const pendingWakes = useRef(new Set<string>());
  const failedReads = useRef(0);
  const isReading = useRef(false);
  const [isBackedOff, setIsBackedOff] = useState(false);

  const facts = useMemo(() => parseWatchSignature({ signature: watchSignature }), [watchSignature]);
  const watched = useMemo(
    () =>
      watchedFactsOf({
        facts,
        rerunMountIds: new Set(
          rerunSignature === ''
            ? []
            : rerunSignature.split(';').map((value) => brandId<MountId>({ value })),
        ),
      }),
    [facts, rerunSignature],
  );
  const watchedRef = useRef(watched);
  watchedRef.current = watched;
  const isWatching = watched.length > 0;

  useEffect(
    () => rerunNotes.subscribe({ onChange: () => setRerunSignature(rerunNotes.snapshot()) }),
    [],
  );

  useEffect(() => {
    void sweepRequests({ isCurrentFirst: true });
  }, [sweepRequests, githubAvailable, hostBindingSignature]);

  useEffect(() => {
    const next = parseBranchSignature({ signature: branchSignature });
    const previous = knownBranches.current;
    knownBranches.current = next;
    if (previous === null) {
      return;
    }
    const changed = changedBranchSessions({ previous, next });
    if (changed.length === 0) {
      return;
    }
    if (changed.length > 1) {
      void sweepRequests();
      return;
    }
    const [sessionId] = changed;
    if (sessionId !== undefined) {
      void sweepRequests({ sessionId });
    }
  }, [sweepRequests, branchSignature]);

  useEffect(() => {
    const previous = knownFacts.current;
    knownFacts.current = new Map(facts.map((fact) => [factKeyOf({ fact }), fact]));
    if (previous === null) {
      return;
    }
    for (const fact of failedChecksSince({ previous, next: facts })) {
      void wakeOnFailure({
        fact,
        agents: wakeCandidatesOf({ state: useAppStore.getState(), sessionId: fact.sessionId }),
        wakes: wakes.current,
        pending: pendingWakes.current,
      });
    }
  }, [facts]);

  useEffect(() => {
    if (!isWatching) {
      failedReads.current = 0;
      setIsBackedOff(false);
    }
  }, [isWatching]);

  usePoll({
    run: () => {
      void sweepRequests({ shouldSkipUnknownRequest: true }).then(() => {
        const mountIds = watchedRef.current.map((fact) => fact.mountId);
        if (!readFailedOf({ state: useAppStore.getState(), mountIds })) {
          failedReads.current = 0;
          setIsBackedOff(false);
        }
      });
    },
    everyMs: WATCH.slowMs,
    isImmediate: false,
  });

  usePoll({
    run: () => {
      if (isReading.current) {
        return;
      }
      isReading.current = true;
      const reading = watchedRef.current;
      const sessionIds = [...new Set(reading.map((fact) => fact.sessionId))];
      void (async () => {
        try {
          for (const sessionId of sessionIds) {
            await sweepRequests({
              sessionId,
              mountIds: watchedMountIdsOf({ facts: reading, sessionId }),
            });
          }
          const mountIds = reading.map((fact) => fact.mountId);
          failedReads.current = readFailedOf({ state: useAppStore.getState(), mountIds })
            ? failedReads.current + 1
            : 0;
          if (failedReads.current >= WATCH.maxFailedReads) {
            setIsBackedOff(true);
          }
        } finally {
          isReading.current = false;
        }
      })();
    },
    everyMs: WATCH.fastMs,
    isEnabled: isWatching && !isBackedOff,
    isImmediate: false,
  });
};
