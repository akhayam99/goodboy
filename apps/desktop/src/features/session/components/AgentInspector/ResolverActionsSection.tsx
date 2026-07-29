import { useEffect, useState } from 'react';
import { Clock, MessageSquareReply, Play, Upload, X } from 'lucide-react';
import { InlineConfirm, Textarea, cn } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ResolverThreadOutcome } from '../../../../store/types';
import { PROCEED_RESOLVER_PROMPT } from '../../../../shared/utils/proceedResolverPrompt';
import type { ResolverStatus } from '../../resolver-linkage';
import { agentThreadIds } from '../../agentThreadIds';
import { INSPECTOR_ACTION_CLASS, InspectorSection } from '../InspectorSection';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly status: ResolverStatus;
  readonly commitSha: string | null;
};

const EMPTY_PENDING: ReadonlyArray<never> = [];
const EMPTY_OUTCOMES: Readonly<Record<string, ResolverThreadOutcome>> = {};

export const ResolverActionsSection = ({ agent, sessionId, status, commitSha }: Props) => {
  const resolveGithubThread = useAppStore((state) => state.resolveGithubThread);
  const resolveAgentThreads = useAppStore((state) => state.resolveAgentThreads);
  const queueResolution = useAppStore((state) => state.queueResolution);
  const dequeueResolution = useAppStore((state) => state.dequeueResolution);
  const activateNextResolver = useAppStore((state) => state.activateNextResolver);
  const sendTurn = useAppStore((state) => state.sendTurn);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const prNumber = useAppStore((state) => state.sessionGithub[sessionId]?.pr?.number ?? null);
  const pending =
    useAppStore((state) => state.sessionPendingResolutions[sessionId]) ?? EMPTY_PENDING;
  const outcomes = useAppStore((state) => state.resolverThreadOutcomes[agent.id]) ?? EMPTY_OUTCOMES;
  const [reason, setReason] = useState('');
  const [armed, setArmed] = useState<'push' | 'explain' | null>(null);

  useEffect(() => {
    setReason('');
    setArmed(null);
  }, [agent.id]);

  const threadIds = agentThreadIds(agent);
  const isCombined = threadIds.length >= 2;
  const threadId = threadIds[0] ?? null;
  const pendingResolutions = pending.filter((resolution) =>
    threadIds.includes(resolution.threadId),
  );
  const pendingResolution = pendingResolutions[0] ?? null;
  const effectiveCommitSha = pendingResolution?.commitSha ?? commitSha;
  const resolvedTargets = Object.entries(outcomes).flatMap(([targetThreadId, outcome]) =>
    outcome.kind === 'resolved' ? [{ threadId: targetThreadId, commitSha: outcome.commitSha }] : [],
  );
  const queueTargets =
    resolvedTargets.length > 0
      ? resolvedTargets
      : effectiveCommitSha !== null
        ? threadIds.map((targetThreadId) => ({
            threadId: targetThreadId,
            commitSha: effectiveCommitSha,
          }))
        : [];
  const push = async () => {
    if (threadId === null || effectiveCommitSha === null) {
      return;
    }
    if (isCombined) {
      await resolveAgentThreads(sessionId, agent.id);
      return;
    }
    const didResolve = await resolveGithubThread(sessionId, threadId, {
      commitSha: effectiveCommitSha,
    });
    if (didResolve && pendingResolution !== null) {
      await dequeueResolution(sessionId, threadId);
    }
  };
  const queue = async () => {
    if (prNumber === null) {
      return;
    }
    for (const target of queueTargets) {
      await queueResolution(sessionId, { ...target, prNumber });
    }
  };
  const explain = async () => {
    if (threadIds.length === 0 || reason.trim() === '') {
      return;
    }
    for (const targetThreadId of threadIds) {
      await resolveGithubThread(sessionId, targetThreadId, { reason: reason.trim() });
    }
  };
  const dequeueAll = async () => {
    for (const resolution of pendingResolutions) {
      await dequeueResolution(sessionId, resolution.threadId);
    }
  };

  if (status === 'committed') {
    const isBatched = pendingResolutions.length > 0;
    const pushLabel = isBatched ? 'Push now' : 'Push & resolve';
    return (
      <InspectorSection question="What you can do with the thread">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {isBatched ? (
              <button
                type="button"
                onClick={() => void dequeueAll()}
                className={INSPECTOR_ACTION_CLASS}
              >
                <X size={9} aria-hidden />
                Remove from batch
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setArmed('push')}
              disabled={!isBatched && (threadId === null || effectiveCommitSha === null)}
              className={cn(INSPECTOR_ACTION_CLASS, 'text-primary hover:text-primary')}
            >
              <Upload size={9} aria-hidden />
              {pushLabel}
            </button>
            {isBatched ? null : (
              <button
                type="button"
                onClick={() => void queue()}
                disabled={queueTargets.length === 0 || prNumber === null}
                className={INSPECTOR_ACTION_CLASS}
              >
                <Clock size={9} aria-hidden />
                Queue for batch push
              </button>
            )}
          </div>
          {armed === 'push' && (
            <InlineConfirm
              role="primary"
              icon={<Upload size={12} aria-hidden />}
              title={`${pushLabel}?`}
              description="Posts the resolution to GitHub and marks the review thread resolved."
              confirmLabel={pushLabel}
              onConfirm={async () => {
                await push();
                setArmed(null);
              }}
              onCancel={() => setArmed(null)}
            />
          )}
        </div>
      </InspectorSection>
    );
  }

  if (status === 'wontfix' || status === 'analyzed') {
    return (
      <InspectorSection question="What you can do with the thread">
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-label="resolution explanation"
          placeholder="Explain why this can be closed"
          autoGrow
          maxRows={6}
          className="min-h-16 resize-none bg-background/60 px-2 py-1.5 text-xs leading-relaxed"
        />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {status === 'analyzed' ? (
              <button
                type="button"
                onClick={() =>
                  void sendTurn({
                    sessionId,
                    agentId: agent.id,
                    content: PROCEED_RESOLVER_PROMPT,
                  })
                }
                className={INSPECTOR_ACTION_CLASS}
              >
                <Play size={9} aria-hidden />
                Proceed with fix
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setArmed('explain')}
              disabled={threadIds.length === 0 || reason.trim() === ''}
              className={cn(INSPECTOR_ACTION_CLASS, 'text-warning hover:text-warning')}
            >
              <MessageSquareReply size={9} aria-hidden />
              Post explanation & close
            </button>
          </div>
          {armed === 'explain' && (
            <InlineConfirm
              role="alert"
              icon={<MessageSquareReply size={12} aria-hidden />}
              title="Post explanation and close?"
              description="Publishes the explanation on GitHub and closes the review thread without a fix."
              confirmLabel="Post & close"
              onConfirm={async () => {
                await explain();
                setArmed(null);
              }}
              onCancel={() => setArmed(null)}
            />
          )}
        </div>
      </InspectorSection>
    );
  }

  if (status === 'awaiting') {
    return (
      <InspectorSection question="What you can do with the thread">
        <button
          type="button"
          onClick={() => {
            void selectAgent(sessionId, agent.id).then(() => {
              window.dispatchEvent(new CustomEvent('goodboy:focus-composer'));
            });
          }}
          className={INSPECTOR_ACTION_CLASS}
        >
          Continue working
        </button>
      </InspectorSection>
    );
  }

  if (status === 'pending') {
    return (
      <InspectorSection question="What you can do with the thread">
        <button
          type="button"
          onClick={() => void activateNextResolver(sessionId)}
          className={INSPECTOR_ACTION_CLASS}
        >
          <Play size={9} aria-hidden />
          Run now
        </button>
      </InspectorSection>
    );
  }

  if (status === 'running') {
    return (
      <InspectorSection question="What you can do with the thread">
        <p className="text-2xs italic text-muted-foreground/70">
          working on it, force close above if it is stuck
        </p>
      </InspectorSection>
    );
  }

  if (status === 'resolved' || status === 'done' || status === 'stopped') {
    return (
      <InspectorSection question="What you can do with the thread">
        <p className="text-2xs italic text-muted-foreground/70">nothing left to do here</p>
      </InspectorSection>
    );
  }

  return (
    <InspectorSection question="What you can do with the thread">
      <p className="text-2xs italic text-muted-foreground/70">no additional actions right now</p>
    </InspectorSection>
  );
};
