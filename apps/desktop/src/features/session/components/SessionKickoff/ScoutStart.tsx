import { useState } from 'react';
import { Button, Input } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { StartFooter } from './StartFooter';

type Props = {
  readonly session: Session;
};

const SCOUT_BRIEF =
  'Read this project and suggest where to start: what needs doing, and which piece to pick up first.';

type BriefParams = {
  readonly focus: string;
};

export const scoutKickoffPrompt = ({ focus }: BriefParams): string => {
  const trimmed = focus.trim();
  return trimmed === '' ? SCOUT_BRIEF : `${SCOUT_BRIEF}\n\nFocus on: ${trimmed}`;
};

export const ScoutStart = ({ session }: Props) => {
  const spawnAgent = useAppStore((state) => state.spawnAgent);
  const reportError = useAppStore((state) => state.reportError);
  const [focus, setFocus] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  const start = async () => {
    if (isStarting) {
      return;
    }
    setIsStarting(true);
    try {
      await spawnAgent(session.id, {
        kindOverride: 'scout',
        initialPrompt: scoutKickoffPrompt({ focus }),
        focus: 'agent',
      });
      window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
    } catch (error) {
      void reportError({ title: "Couldn't start Scout", error, sessionId: session.id });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={focus}
        onChange={(event) => setFocus(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') {
            return;
          }
          event.preventDefault();
          void start();
        }}
        aria-label="Scout focus"
        placeholder="Optional: an area, a file or a question"
        data-kickoff-field
        className="h-8 text-sm"
      />
      <StartFooter note="Scout only reads. It changes nothing.">
        <Button
          size="sm"
          disabled={isStarting}
          isBusy={isStarting}
          busyLabel="Starting Scout"
          onClick={() => void start()}
        >
          Start Scout
        </Button>
      </StartFooter>
    </div>
  );
};
