import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn, SHEET_CLASSES, useEscapeLayer } from '@goodboy/ui';
import { StudioBand } from '../../../shared/components/StudioShell/StudioBand';
import {
  StudioFrameContext,
  type StudioChrome,
  type StudioFrameHandle,
} from '../../../shared/components/StudioShell/studioFrameContext';
import { STUDIO_EXIT_MS } from '../../../shared/hooks/useStudioOverlay';
import type { StudioKind } from '../../../store';
import { STUDIO_META } from './studioMeta';
import { StudioSkeleton } from './StudioSkeleton';

type Props = {
  readonly kind: StudioKind;
  readonly onClose: () => void;
  readonly children: ReactNode;
};

export const StudioFrame = ({ kind, onClose, children }: Props) => {
  const [chrome, setChrome] = useState<StudioChrome | null>(null);
  const [closingKind, setClosingKind] = useState<StudioKind | null>(null);
  const kindRef = useRef(kind);
  kindRef.current = kind;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isClosing = closingKind === kind;

  const requestClose = useCallback(() => setClosingKind(kindRef.current), []);
  const [trailSlot, setTrailSlot] = useState<HTMLElement | null>(null);
  const [trailClaims, setTrailClaims] = useState(0);
  const claimTrail = useCallback(() => {
    setTrailClaims((count) => count + 1);
    return () => setTrailClaims((count) => count - 1);
  }, []);

  useEffect(() => {
    if (!isClosing) {
      return;
    }
    const timer = setTimeout(() => onCloseRef.current(), STUDIO_EXIT_MS);
    return () => clearTimeout(timer);
  }, [isClosing]);

  useEscapeLayer(requestClose, !isClosing && (chrome?.isEscapeEnabled ?? true));

  const handle = useMemo<StudioFrameHandle>(
    () => ({ setChrome, requestClose, trailSlot, claimTrail }),
    [requestClose, trailSlot, claimTrail],
  );
  const meta = STUDIO_META[kind];
  const band = { ...meta, ...chrome };

  return (
    <StudioFrameContext.Provider value={handle}>
      <div
        data-studio-frame=""
        data-studio-overlay=""
        data-studio={kind}
        className={cn(
          'relative flex h-full w-full min-h-0 flex-col bg-chrome',
          isClosing ? 'motion-safe:animate-studio-out' : 'motion-safe:animate-studio-in',
        )}
      >
        <StudioBand
          crumbKey={kind}
          icon={band.icon}
          {...('tone' in band && band.tone !== undefined && { tone: band.tone })}
          {...(chrome?.glyph !== undefined && { glyph: chrome.glyph })}
          title={band.title}
          {...(chrome?.subtitle !== undefined && { subtitle: chrome.subtitle })}
          closeLabel={band.closeLabel}
          accessory={chrome?.accessory}
          isTrailClaimed={trailClaims > 0}
          trailSlotRef={setTrailSlot}
          onClose={requestClose}
        />
        <div
          className={cn(
            'relative flex min-h-0 min-w-0 flex-1 bg-background',
            SHEET_CLASSES.flush,
            'has-[[data-studio-rail]]:border-y-0',
          )}
        >
          <Suspense fallback={<StudioSkeleton layout={meta.skeleton} title={meta.title} />}>
            {children}
          </Suspense>
        </div>
      </div>
    </StudioFrameContext.Provider>
  );
};
