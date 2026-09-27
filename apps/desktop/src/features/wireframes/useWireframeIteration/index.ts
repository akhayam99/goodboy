import { useCallback, useEffect, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { SessionId, WireframeArtifact } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { WireframeChangeScope, WireframePickedNode } from '../buildWireframeChangeRequest';
import type { WireframeDraft } from '../wireframeDraft';

export const READY_OFFER_MS = 10_000;

type Params = {
  readonly sessionId: SessionId;
  readonly artifact: WireframeArtifact;
  readonly screen: Readonly<{ id: string; title: string }> | null;
};

export type WireframeIteration = Readonly<{
  ask: string;
  setAsk: (ask: string) => void;
  picked: ReadonlyArray<WireframePickedNode>;
  pick: (node: WireframePickedNode) => void;
  unpick: (nodeId: string) => void;
  isPicking: boolean;
  setIsPicking: (isPicking: boolean) => void;
  scope: WireframeChangeScope;
  setScope: (scope: WireframeChangeScope) => void;
  draft: WireframeDraft | null;
  send: () => void;
  askAgain: () => void;
  dismiss: () => void;
  restore: (revision: number) => void;
  restoreError: string | null;
}>;

export const useWireframeIteration = ({
  sessionId,
  artifact,
  screen,
}: Params): WireframeIteration => {
  const draft = useAppStore((s) => s.wireframeDrafts[artifact.id] ?? null);
  const requestWireframeChange = useAppStore((s) => s.requestWireframeChange);
  const settleWireframeDraft = useAppStore((s) => s.settleWireframeDraft);
  const restoreArtifactRevision = useAppStore((s) => s.restoreArtifactRevision);
  const [ask, setAsk] = useState('');
  const [picked, setPicked] = useState<ReadonlyArray<WireframePickedNode>>([]);
  const [isPicking, setIsPicking] = useState(false);
  const [scope, setScope] = useState<WireframeChangeScope>('screen');
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const pick = useCallback((node: WireframePickedNode) => {
    setPicked((previous) =>
      previous.some((entry) => entry.nodeId === node.nodeId) ? previous : [...previous, node],
    );
  }, []);
  const unpick = useCallback((nodeId: string) => {
    setPicked((previous) => previous.filter((entry) => entry.nodeId !== nodeId));
  }, []);

  const submit = useCallback(
    (params: {
      readonly ask: string;
      readonly scope: WireframeChangeScope;
      readonly screenId: string | null;
      readonly picked: ReadonlyArray<WireframePickedNode>;
    }) => {
      setIsPicking(false);
      void requestWireframeChange({
        sessionId,
        artifact,
        screenTitle: screen?.id === params.screenId ? (screen?.title ?? null) : null,
        ...params,
      });
    },
    [artifact, requestWireframeChange, screen, sessionId],
  );

  const send = useCallback(() => {
    if (ask.trim().length === 0 || draft?.status === 'drafting') {
      return;
    }
    submit({ ask, scope, screenId: screen?.id ?? null, picked });
  }, [ask, draft, picked, scope, screen, submit]);

  const askAgain = useCallback(() => {
    if (draft === null || draft.status !== 'failed') {
      return;
    }
    submit({ ask: draft.ask, scope: draft.scope, screenId: draft.screenId, picked: draft.picked });
  }, [draft, submit]);

  useEffect(() => {
    if (draft?.status !== 'ready') {
      return;
    }
    setAsk('');
    setPicked([]);
    const timer = window.setTimeout(
      () => settleWireframeDraft(artifact.id),
      Math.max(0, draft.settledAt + READY_OFFER_MS - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [artifact.id, draft, settleWireframeDraft]);

  const restore = useCallback(
    (revision: number) => {
      setRestoreError(null);
      restoreArtifactRevision({ sessionId, artifact, revision }).catch((cause: unknown) =>
        setRestoreError(formatError(cause)),
      );
    },
    [artifact, restoreArtifactRevision, sessionId],
  );

  return {
    ask,
    setAsk,
    picked,
    pick,
    unpick,
    isPicking,
    setIsPicking,
    scope,
    setScope,
    draft,
    send,
    askAgain,
    dismiss: () => settleWireframeDraft(artifact.id),
    restore,
    restoreError,
  };
};
