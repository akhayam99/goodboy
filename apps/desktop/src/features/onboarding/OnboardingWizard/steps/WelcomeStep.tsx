import { useEffect, useRef, type CSSProperties } from 'react';
import { Button, KeyHint } from '@goodboy/ui';
import { BrandTile } from '../../../../shared/components/BrandTile';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { useAgentRows } from '../useAgentRows';
import { useSplashAnchor } from '../useSplashAnchor';
import { SPLASH_TILE_PX } from '../useSplashAnchor/splashShift';
import { DetectionLine } from './DetectionLine';

type Props = {
  readonly isLocked: boolean;
  readonly onStart: () => void;
};

type DelayStyle = CSSProperties & Readonly<Record<'--welcome-delay', string>>;

const delay = (ms: number): DelayStyle => ({ '--welcome-delay': `${ms}ms` });

export const WelcomeStep = ({ isLocked, onStart }: Props) => {
  const { rows } = useAgentRows();
  const blockRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  useSplashAnchor({ markRef, blockRef });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => startRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      ref={blockRef}
      data-testid="welcome-cover"
      className="welcome-entrance flex flex-col items-center gap-6 text-center"
    >
      <div ref={markRef} className="welcome-tile relative">
        <BrandTile size={SPLASH_TILE_PX} />
        <div
          aria-hidden
          className="welcome-splash-word pointer-events-none absolute top-25 left-1/2 -translate-x-1/2 whitespace-nowrap"
        >
          <span className="text-display text-foreground">Goodboy</span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <h2
          tabIndex={-1}
          data-step-title
          className="welcome-rise text-display text-foreground outline-none"
          style={delay(280)}
        >
          Welcome to Goodboy
        </h2>
        <p className="welcome-rise text-balance text-read text-muted-foreground" style={delay(340)}>
          Goodboy runs coding agents side by side on your own repositories, one session for each
          goal. Each session works on its own branch when it needs one, and nothing is pushed until
          you say so.
        </p>
      </div>
      <div className="welcome-rise" style={delay(400)}>
        <DetectionLine rows={rows} />
      </div>
      <div className="welcome-rise flex flex-col items-center gap-3" style={delay(460)}>
        <Button
          ref={startRef}
          size="md"
          variant="primary"
          disabled={isLocked}
          onClick={onStart}
          data-demo-anchor="setup-start"
        >
          Get started
          <KeyHint keys={shortcutGlyphs('composer.send')} isOnTone />
        </Button>
        <p className="text-meta text-faint-foreground">
          About a minute. Nothing is saved until you create a workspace.
        </p>
      </div>
    </div>
  );
};
