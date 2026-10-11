import {
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  cn,
  DrawerColumn,
  readStudioRailWidth,
  SHEET_CLASSES,
  StudioSlotContext,
  UnderTrailContext,
  useEscapeLayer,
} from '@goodboy/ui';
import { StudioBand } from '../../../shared/components/StudioShell/StudioBand';
import {
  StudioFrameContext,
  type StudioChrome,
  type StudioDrawerSpec,
  type StudioFrameHandle,
} from '../../../shared/components/StudioShell/studioFrameContext';
import { STUDIO_EXIT_MS } from '../../../shared/hooks/useStudioOverlay';
import type { StudioKind } from '../../../store';
import { STUDIO_META } from './studioMeta';
import { captureStudioOpener } from './captureStudioOpener';
import { restoreStudioOpener } from './restoreStudioOpener';
import { StudioSkeleton } from './StudioSkeleton';
import type { StudioPlacement } from './studioPlacement';

type Props = {
  readonly kind: StudioKind;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly placement?: StudioPlacement;
  readonly isClosable?: boolean;
  readonly hasBand?: boolean;
};

export const StudioFrame = ({
  kind,
  onClose,
  children,
  placement = 'cover',
  isClosable = true,
  hasBand = true,
}: Props) => {
  const [chrome, setChrome] = useState<StudioChrome | null>(null);
  const [drawerSpec, setDrawerSpec] = useState<StudioDrawerSpec | null>(null);
  const [closingKind, setClosingKind] = useState<StudioKind | null>(null);
  const [opener] = useState(captureStudioOpener);
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

  useEffect(() => () => restoreStudioOpener({ opener, kind: kindRef.current }), [opener]);

  useEffect(() => {
    if (!isClosing) {
      return;
    }
    const timer = setTimeout(() => onCloseRef.current(), STUDIO_EXIT_MS);
    return () => clearTimeout(timer);
  }, [isClosing]);

  useEscapeLayer(requestClose, !isClosing && (chrome?.isEscapeEnabled ?? true));

  const meta = STUDIO_META[kind];
  const isInSlot = useContext(StudioSlotContext);
  const isDrawerHost =
    isInSlot && placement === 'content' && 'canHostDrawer' in meta && meta.canHostDrawer;
  const handle = useMemo<StudioFrameHandle>(
    () => ({
      setChrome,
      requestClose,
      trailSlot,
      claimTrail,
      setDrawer: isDrawerHost ? setDrawerSpec : null,
    }),
    [requestClose, trailSlot, claimTrail, isDrawerHost],
  );
  const band = { ...meta, ...chrome };

  const framed = (
    <>
      {hasBand ? (
        <StudioBand
          crumbKey={kind}
          icon={band.icon}
          {...('tone' in band && band.tone !== undefined && { tone: band.tone })}
          {...(chrome?.glyph !== undefined && { glyph: chrome.glyph })}
          width={meta.tier}
          title={band.title}
          {...(chrome?.subtitle !== undefined && { subtitle: chrome.subtitle })}
          closeLabel={band.closeLabel}
          isClosable={isClosable}
          accessory={chrome?.accessory}
          isTrailClaimed={trailClaims > 0}
          trailSlotRef={setTrailSlot}
          onClose={requestClose}
        />
      ) : null}
      <div
        className={cn(
          'relative flex min-h-0 min-w-0 flex-1 bg-background',
          placement === 'cover' && SHEET_CLASSES.flush,
          placement === 'cover' && 'has-[[data-studio-rail]]:border-y-0',
        )}
      >
        <Suspense
          fallback={
            <StudioSkeleton
              layout={hasBand ? meta.skeleton : 'list'}
              title={meta.title}
              railWidthPx={readStudioRailWidth({
                surface: kind,
                railWidth: 'railWidth' in meta ? meta.railWidth : 'standard',
              })}
            />
          }
        >
          {hasBand ? (
            <UnderTrailContext.Provider value>{children}</UnderTrailContext.Provider>
          ) : (
            children
          )}
        </Suspense>
      </div>
    </>
  );

  return (
    <StudioFrameContext.Provider value={handle}>
      <div
        data-studio-frame=""
        data-studio-overlay=""
        data-studio={kind}
        data-studio-placement={placement}
        {...(isDrawerHost && { 'data-studio-sheet-owner': '' })}
        className={cn(
          'relative flex h-full w-full min-h-0 flex-col',
          placement === 'cover' || isDrawerHost ? 'bg-chrome' : 'bg-background',
          isClosing ? 'motion-safe:animate-studio-out' : 'motion-safe:animate-studio-in',
        )}
      >
        {isDrawerHost ? (
          <DrawerColumn
            frame="sheet"
            main={framed}
            drawer={
              drawerSpec?.node == null ? null : hasBand ? (
                <UnderTrailContext.Provider value>{drawerSpec.node}</UnderTrailContext.Provider>
              ) : (
                drawerSpec.node
              )
            }
            ariaLabel={drawerSpec?.ariaLabel ?? 'Side panel'}
            resizeLabel={drawerSpec?.resizeLabel ?? 'Resize side panel'}
            {...(drawerSpec?.drawerKey !== undefined && { drawerKey: drawerSpec.drawerKey })}
            {...(drawerSpec?.drawerRef !== undefined && { drawerRef: drawerSpec.drawerRef })}
          />
        ) : (
          framed
        )}
      </div>
    </StudioFrameContext.Provider>
  );
};
