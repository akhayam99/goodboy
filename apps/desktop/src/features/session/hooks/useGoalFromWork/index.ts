import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY } from '../../../../store';
import { useAppStore } from '../../../../store/store';
import { issueBriefKey } from '../../../../store/slices/issue-briefs/issueBriefKey';
import { linkedIssueSources } from '../../../../store/slices/issue-briefs/linkedIssueSources';
import { readLinkedIssueSources } from '../../../../store/slices/issue-briefs/readLinkedIssueSources';
import { writeGoalFromWorkEvent } from '../../../../store/slices/issue-briefs/writeGoalFromWorkEvent';
import type { IssueBriefSource } from '../../../../store/slices/issue-briefs/types';
import { selectIssueBrief } from '../../../../store/slices/issue-briefs/selectIssueBrief';

type Params = { readonly session: Session };

export const useGoalFromWork = ({ session }: Params) => {
  const sessionId = session.id;
  const workspaceId = session.workspaceId;
  const tasks = useAppStore((state) => state.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const linked = useMemo(() => linkedIssueSources({ tasks }), [tasks]);
  const linkedSignature = JSON.stringify(
    linked.map((source) => [
      source.provider,
      source.externalId,
      source.identifier,
      source.title,
      source.url,
    ]),
  );
  const selected = useMemo(() => linked.slice(0, 5), [linked]);
  const readingCount = selected.length;
  const [sources, setSources] = useState<ReadonlyArray<IssueBriefSource> | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useRef(0);
  const key = sources === null ? null : issueBriefKey({ sources });
  const entry = useAppStore((state) => selectIssueBrief({ state, key }));
  const dismiss = useCallback(() => {
    token.current += 1;
    setSources(null);
    setIsReading(false);
    setError(null);
  }, []);
  useEffect(() => {
    dismiss();
    return () => {
      token.current += 1;
    };
  }, [sessionId, linkedSignature, dismiss]);
  const write = useCallback(async () => {
    if (linked.length === 0) {
      return;
    }
    const requestToken = ++token.current;
    setIsReading(true);
    setSources(null);
    setError(null);
    const state = useAppStore.getState();
    try {
      const read = await readLinkedIssueSources({
        sources: selected,
        workspaceId,
        integrations: state.workspaceIntegrations[workspaceId] ?? EMPTY_ARRAY,
      });
      if (token.current !== requestToken) {
        return;
      }
      setSources(read);
      setIsReading(false);
      await state.requestIssueBrief({ sources: read, workspaceId, sessionId, isRetry: true });
    } catch (cause) {
      if (token.current !== requestToken) {
        return;
      }
      setIsReading(false);
      setError(formatError(cause));
    }
  }, [linked, selected, workspaceId, sessionId]);
  useEffect(() => {
    const eventName = writeGoalFromWorkEvent({ sessionId });
    const onRequest = () => {
      void write();
    };
    window.addEventListener(eventName, onRequest);
    return () => window.removeEventListener(eventName, onRequest);
  }, [sessionId, write]);
  const identifiers = linked.map((source) => source.identifier);
  const label =
    identifiers.length > 2
      ? `${identifiers[0] ?? ''} and ${identifiers.length - 1} more`
      : identifiers.join(' and ');
  return { linked, readingCount, sources, entry, isReading, error, label, write, dismiss };
};
