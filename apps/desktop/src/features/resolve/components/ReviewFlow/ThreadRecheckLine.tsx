import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { stripControlMarkers } from '@goodboy/core';
import { WorkNode } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useTranscript } from '../../../../store/transcript';
import { reduceTranscript } from '../../../chat/utils/transcript-items';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { draftRoutingOf } from '../../draftFixes';
import { RECHECK_LABEL } from '../../reviewFlowCopy';
import { recheckModelOf } from '../../startRecheck';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
};

type LiveProps = { readonly agentId: AgentId };

const lastLineOf = ({ text }: { readonly text: string }): string =>
  stripControlMarkers(text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .at(-1) ?? '';

const RecheckLive = ({ agentId }: LiveProps) => {
  const transcript = useTranscript(agentId);
  const live = useMemo(() => {
    const items = reduceTranscript(transcript);
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item?.kind === 'assistant_text') {
        return lastLineOf({ text: item.text });
      }
    }
    return '';
  }, [transcript]);
  return (
    <p
      aria-live="polite"
      className="min-w-0 truncate pl-7 text-secondary text-muted-foreground motion-safe:animate-studio-in"
    >
      {live === '' ? RECHECK_LABEL.looking : live}
    </p>
  );
};

export const ThreadRecheckLine = ({ sessionId, agentId }: Props) => {
  const provider = useAppStore(useShallow((s) => draftRoutingOf({ state: s, sessionId }))).provider;
  const model = recheckModelOf({ provider });
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="flex min-w-0 items-center gap-2 text-label">
        <WorkNode state="running" label={RECHECK_LABEL.running} mark={{ kind: 'dot' }} />
        <span className="shrink-0 text-foreground">{RECHECK_LABEL.running}</span>
        {model !== null && (
          <span className="min-w-0 truncate text-muted-foreground">· {modelLabel(model)}</span>
        )}
      </p>
      {agentId === null ? (
        <p className="min-w-0 truncate pl-7 text-secondary text-muted-foreground">
          {RECHECK_LABEL.looking}
        </p>
      ) : (
        <RecheckLive agentId={agentId} />
      )}
    </div>
  );
};
