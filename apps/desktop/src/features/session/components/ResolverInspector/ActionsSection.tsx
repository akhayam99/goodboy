import { useEffect, useState } from 'react';
import { Clock, MessageSquareReply, Play, Upload, X } from 'lucide-react';
import { Textarea } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ConfirmableButton } from '../../../../shared/components/ConfirmableButton';
import { PROCEED_RESOLVER_PROMPT } from '../../../../shared/utils/proceedResolverPrompt';
import type { ResolverStatus } from '../../resolver-linkage';
import { InspectorSection } from './InspectorSection';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly status: ResolverStatus;
  readonly commitSha: string | null;
};

const SINGLE_ACTION_CLASS =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50';

export const ActionsSection = ({ agent, sessionId, status, commitSha }: Props) => {
  const resolveGithubThread = useAppStore((state) => state.resolveGithubThread);
  const queueResolution = useAppStore((state) => state.queueResolution);
  const dequeueResolution = useAppStore((state) => state.dequeueResolution);
  const activateNextResolver = useAppStore((state) => state.activateNextResolver);
  const sendTurn = useAppStore((state) => state.sendTurn);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const prNumber = useAppStore((state) => state.sessionGithub[sessionId]?.pr?.number ?? null);
  const pendingResolution = useAppStore(
    (state) =>
      state.sessionPendingResolutions[sessionId]?.find(
        (resolution) => resolution.threadId === agent.sourceThreadId,
      ) ?? null,
  );
  const [reason, setReason] = useState('');

  useEffect(() => setReason(''), [agent.id]);

  const threadId = agent.sourceThreadId ?? null;
  const effectiveCommitSha = pendingResolution?.commitSha ?? commitSha;
  const push = async () => {
    if (threadId === null || effectiveCommitSha === null) {
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
    if (threadId === null || effectiveCommitSha === null || prNumber === null) {
      return;
    }
    await queueResolution(sessionId, { threadId, commitSha: effectiveCommitSha, prNumber });
  };
  const explain = async () => {
    if (threadId === null || reason.trim() === '') {
      return;
    }
    await resolveGithubThread(sessionId, threadId, { reason: reason.trim() });
  };

  if (status === 'committed') {
    return (
      <InspectorSection question="What you can do">
        <div className="flex flex-wrap items-center gap-1.5">
          {pendingResolution === null ? (
            <>
              <ConfirmableButton
                label="Push & resolve"
                armedLabel="Confirm push & resolve"
                busyLabel="Pushing..."
                onConfirm={push}
                disabled={threadId === null || effectiveCommitSha === null}
                tone="accent"
                icon={<Upload size={9} aria-hidden />}
              />
              <button
                type="button"
                onClick={() => void queue()}
                disabled={threadId === null || effectiveCommitSha === null || prNumber === null}
                className={SINGLE_ACTION_CLASS}
              >
                <Clock size={9} aria-hidden />
                Queue for batch push
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void dequeueResolution(sessionId, pendingResolution.threadId)}
                className={SINGLE_ACTION_CLASS}
              >
                <X size={9} aria-hidden />
                Remove from batch
              </button>
              <ConfirmableButton
                label="Push now"
                armedLabel="Confirm push now"
                busyLabel="Pushing..."
                onConfirm={push}
                tone="accent"
                icon={<Upload size={9} aria-hidden />}
              />
            </>
          )}
        </div>
      </InspectorSection>
    );
  }

  if (status === 'wontfix' || status === 'analyzed') {
    return (
      <InspectorSection question="What you can do">
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-label="resolution explanation"
          placeholder="Explain why this can be closed"
          autoGrow
          maxRows={6}
          className="min-h-16 resize-none bg-background/60 px-2 py-1.5 text-xs leading-relaxed"
        />
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
              className={SINGLE_ACTION_CLASS}
            >
              <Play size={9} aria-hidden />
              Proceed with fix
            </button>
          ) : null}
          <ConfirmableButton
            label="Post explanation & close"
            armedLabel="Confirm explanation & close"
            busyLabel="Posting..."
            onConfirm={explain}
            disabled={threadId === null || reason.trim() === ''}
            tone="warning"
            icon={<MessageSquareReply size={9} aria-hidden />}
          />
        </div>
      </InspectorSection>
    );
  }

  if (status === 'awaiting') {
    return (
      <InspectorSection question="What you can do">
        <button
          type="button"
          onClick={() => {
            void selectAgent(sessionId, agent.id).then(() => {
              window.dispatchEvent(new CustomEvent('goodboy:focus-composer'));
            });
          }}
          className={SINGLE_ACTION_CLASS}
        >
          Continue working
        </button>
      </InspectorSection>
    );
  }

  if (status === 'pending') {
    return (
      <InspectorSection question="What you can do">
        <button
          type="button"
          onClick={() => void activateNextResolver(sessionId)}
          className={SINGLE_ACTION_CLASS}
        >
          <Play size={9} aria-hidden />
          Run now
        </button>
      </InspectorSection>
    );
  }

  if (status === 'running') {
    return (
      <InspectorSection question="What you can do">
        <p className="text-2xs italic text-muted-foreground/70">
          working on it, force close above if it is stuck
        </p>
      </InspectorSection>
    );
  }

  if (status === 'resolved' || status === 'done' || status === 'stopped') {
    return (
      <InspectorSection question="What you can do">
        <p className="text-2xs italic text-muted-foreground/70">nothing left to do here</p>
      </InspectorSection>
    );
  }

  return (
    <InspectorSection question="What you can do">
      <p className="text-2xs italic text-muted-foreground/70">no additional actions right now</p>
    </InspectorSection>
  );
};
