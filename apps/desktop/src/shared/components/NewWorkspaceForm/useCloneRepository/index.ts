import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../../store';
import { CommandError } from '../../../lib/invokeCommand';
import { homeFolder } from '../../../lib/homeFolder';
import { cloneCancel } from '../../../lib/repoClone/cloneCancel';
import { cloneFreeDestination } from '../../../lib/repoClone/cloneFreeDestination';
import { cloneProbe } from '../../../lib/repoClone/cloneProbe';
import { cloneRepository } from '../../../lib/repoClone/cloneRepository';
import { onCloneProgress } from '../../../lib/repoClone/onCloneProgress';
import type { CloneHostKey } from '../../../lib/repoClone/repoCloneTypes';
import { cloneFailureKindOf } from '../cloneFailureKindOf';
import type { CloneFailure } from '../cloneFailureTypes';
import { defaultCloneDestination } from '../defaultCloneDestination';
import { expandHome } from '../expandHome';
import { parseCloneSource, type CloneSourceReading } from '../parseCloneSource';
import { tildePath } from '../tildePath';

type CloneStatus = 'idle' | 'checking' | 'cloning';

type CloneProgressView = {
  readonly phase: string;
  readonly percent: number;
};

type ClonedParams = {
  readonly path: string;
};

type Params = {
  readonly onCloned: (params: ClonedParams) => void;
};

type PathParams = {
  readonly path: string;
};

type HostParams = {
  readonly host: CloneHostKey | null;
};

type TextParams = {
  readonly text: string;
};

export type CloneRepository = {
  readonly isOpen: boolean;
  readonly text: string;
  readonly host: CloneHostKey | null;
  readonly destination: string;
  readonly reading: CloneSourceReading;
  readonly status: CloneStatus;
  readonly progress: CloneProgressView | null;
  readonly failure: CloneFailure | null;
  readonly canStart: boolean;
  readonly open: () => void;
  readonly close: () => void;
  readonly setText: (params: TextParams) => void;
  readonly setHost: (params: HostParams) => void;
  readonly setDestination: (params: TextParams) => void;
  readonly start: () => Promise<void>;
  readonly cancel: () => Promise<void>;
  readonly applySuggestion: () => void;
};

type Active = {
  readonly token: number;
  readonly requestId: string;
  readonly phase: CloneStatus;
  readonly isInvoked: boolean;
};

export const useCloneRepository = ({ onCloned }: Params): CloneRepository => {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setTextState] = useState('');
  const [host, setHostState] = useState<CloneHostKey | null>(null);
  const [editedDestination, setEditedDestination] = useState<string | null>(null);
  const [status, setStatus] = useState<CloneStatus>('idle');
  const [progress, setProgress] = useState<CloneProgressView | null>(null);
  const [failure, setFailure] = useState<CloneFailure | null>(null);
  const tokenRef = useRef(0);
  const activeRef = useRef<Active | null>(null);
  const onClonedRef = useRef(onCloned);
  const reportError = useAppStore((state) => state.reportError);
  const reportErrorRef = useRef(reportError);

  useEffect(() => {
    onClonedRef.current = onCloned;
  }, [onCloned]);

  const reading = useMemo(() => parseCloneSource({ text, host }), [text, host]);
  const readingName =
    reading.kind === 'ready' || reading.kind === 'needs-host' ? reading.name : null;
  const destination =
    editedDestination ??
    (readingName === null ? '' : defaultCloneDestination({ name: readingName }));
  const canStart = reading.kind === 'ready' && destination.trim() !== '' && status === 'idle';

  useEffect(() => {
    reportErrorRef.current = reportError;
  }, [reportError]);

  useEffect(
    () => () => {
      const active = activeRef.current;
      tokenRef.current += 1;
      activeRef.current = null;
      if (active?.isInvoked === true) {
        void cloneCancel({ requestId: active.requestId }).catch((cause: unknown) =>
          reportErrorRef.current({
            title: "Couldn't stop the clone",
            error: cause,
            severity: 'warning',
          }),
        );
      }
    },
    [],
  );

  const setText = useCallback(({ text: next }: TextParams) => {
    if (activeRef.current !== null) {
      return;
    }
    setTextState(next);
    setFailure(null);
  }, []);

  const setHost = useCallback(({ host: next }: HostParams) => {
    if (activeRef.current !== null) {
      return;
    }
    setHostState(next);
    setFailure(null);
  }, []);

  const setDestination = useCallback(({ text: next }: TextParams) => {
    if (activeRef.current !== null) {
      return;
    }
    setEditedDestination(next);
    setFailure(null);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);

  const close = useCallback(() => {
    if (activeRef.current !== null) {
      return;
    }
    setIsOpen(false);
    setFailure(null);
  }, []);

  const suggestionOf = async ({ path }: PathParams): Promise<string | null> => {
    try {
      return await cloneFreeDestination({ path });
    } catch (cause) {
      await reportError({
        title: "Couldn't suggest another folder name",
        error: cause,
        severity: 'warning',
      });
      return null;
    }
  };

  const start = async () => {
    if (
      reading.kind !== 'ready' ||
      activeRef.current !== null ||
      status !== 'idle' ||
      destination.trim() === ''
    ) {
      return;
    }
    tokenRef.current += 1;
    const token = tokenRef.current;
    const requestId = crypto.randomUUID();
    activeRef.current = { token, requestId, phase: 'checking', isInvoked: false };
    setStatus('checking');
    setFailure(null);
    setProgress(null);
    let unlisten: (() => void) | null = null;
    const home = await homeFolder();
    if (token !== tokenRef.current) {
      return;
    }
    const path = expandHome({ text: destination, home });
    try {
      const probe = await cloneProbe({ url: reading.remote, destination: path });
      if (token !== tokenRef.current) {
        return;
      }
      activeRef.current = { token, requestId, phase: 'cloning', isInvoked: false };
      setStatus('cloning');
      unlisten = await onCloneProgress({
        handler: ({ progress: update }) => {
          if (update.requestId === requestId && token === tokenRef.current) {
            setProgress({ phase: update.phase, percent: update.percent });
          }
        },
      });
      if (token !== tokenRef.current) {
        return;
      }
      activeRef.current = { token, requestId, phase: 'cloning', isInvoked: true };
      const done = await cloneRepository({
        requestId,
        url: reading.remote,
        destination: path,
        route: probe.route,
      });
      if (token !== tokenRef.current) {
        return;
      }
      setIsOpen(false);
      setTextState('');
      setHostState(null);
      setEditedDestination(null);
      onClonedRef.current({ path: done.path });
    } catch (cause) {
      if (token !== tokenRef.current) {
        return;
      }
      const kind = cause instanceof CommandError ? cause.kind : 'failed';
      if (kind === 'cancelled') {
        return;
      }
      const failureKind = cloneFailureKindOf({ kind });
      const free = failureKind === 'destination_not_empty' ? await suggestionOf({ path }) : null;
      if (token !== tokenRef.current) {
        return;
      }
      setFailure({
        kind: failureKind,
        message: cause instanceof Error ? cause.message : 'The clone failed.',
        host: reading.host,
        destination: tildePath({ path, home }),
        suggestion: free === null ? null : tildePath({ path: free, home }),
      });
    } finally {
      unlisten?.();
      if (token === tokenRef.current) {
        activeRef.current = null;
        setStatus('idle');
        setProgress(null);
      }
    }
  };

  const cancel = async () => {
    const active = activeRef.current;
    if (active === null) {
      return;
    }
    if (!active.isInvoked) {
      tokenRef.current += 1;
      activeRef.current = null;
      setStatus('idle');
      return;
    }
    try {
      await cloneCancel({ requestId: active.requestId });
    } catch (cause) {
      if (active.token === tokenRef.current) {
        setFailure({
          kind: 'failed',
          message: cause instanceof Error ? cause.message : "The clone couldn't be stopped.",
          host: null,
          destination,
          suggestion: null,
        });
      }
    }
  };

  const applySuggestion = () => {
    if (failure === null || failure.suggestion === null) {
      return;
    }
    setEditedDestination(failure.suggestion);
    setFailure(null);
  };

  return {
    isOpen,
    text,
    host,
    destination,
    reading,
    status,
    progress,
    failure,
    canStart,
    open,
    close,
    setText,
    setHost,
    setDestination,
    start,
    cancel,
    applySuggestion,
  };
};
