import { useState } from 'react';
import { Button, Eyebrow } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';

type Props = {
  readonly sessionId: SessionId;
};

export const OverviewStartAgent = ({ sessionId }: Props) => {
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      await spawnAgent(sessionId, { focus: 'agent' });
      window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Agents" className="flex flex-col gap-2">
      <Eyebrow label="Agents" />
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void start()}>
          <CONCEPT_ICONS.agents size={13} aria-hidden />
          Start an agent
        </Button>
        <span className="text-xs text-muted-foreground">
          Opens the chat with the full composer. The first message kicks it off.
        </span>
      </div>
    </section>
  );
};
