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
  DrawerEdgeContext,
  PAGE_FRAME,
  readStudioRailWidth,
  SHEET_CLASSES,
  StudioSlotContext,
  UnderTrailContext,
  useEscapeLayer,
} from '@goodboy/ui';
import { StudioBand } from '../../../shared/components/StudioShell/StudioBand';
import { StudioBandContext } from '../../../shared/components/StudioShell/studioBandContext';
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
import { ShellToolRail } from '../ShellToolRail';
import { useOneRightPanel } from '../../hooks/useOneRightPanel';
import type { StudioPlacement } from './studioPlacement';

type Props = {
  readonly kind: StudioKind;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly placement?: StudioPlacement;
};

export const StudioFrame = ({ kind, onClose, children, placement = 'cover' }: Props) => {
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
  const isOuterUnderTrail = useContext(UnderTrailContext);
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
  const title = chrome?.title ?? meta.title;
  const accessory = chrome?.accessory ?? null;
  const isBandClose = meta.close === 'back';
  const isBandDrawn = isBandClose || trailClaims > 0 || accessory !== null;
  const isUnderTrail = isBandDrawn || isOuterUnderTrail;

  const isPanelShown = useOneRightPanel({ spec: drawerSpec, isActive: isDrawerHost });
  const shellEdge = useContext(DrawerEdgeContext);
  const isSplit = meta.page !== null && PAGE_FRAME[meta.page] === 'split';
  const bandNode = isBandDrawn ? (
    <StudioBand
      label={title}
      width={meta.tier}
      isClosable={isBandClose}
      accessory={accessory}
      trailSlotRef={setTrailSlot}
      onClose={requestClose}
    />
  ) : null;

  const framed = (
    <>
      {isSplit ? null : bandNode}
      <div
        className={cn(
          'relative flex min-h-0 min-w-0 flex-1 bg-background',
          placement === 'cover' && SHEET_CLASSES.flush,
          placement === 'cover' && 'has-[[data-studio-rail]]:border-y-0',
        )}
      >
        <Suspense
          fallback={
            <UnderTrailContext.Provider value={isBandClose}>
              <StudioSkeleton
                skeleton={meta.skeleton}
                page={meta.page}
                isBandInDetail={isSplit && isBandClose}
                title={meta.title}
                railWidthPx={readStudioRailWidth({
                  surface: kind,
                  railWidth: 'railWidth' in meta ? meta.railWidth : 'standard',
                })}
              />
            </UnderTrailContext.Provider>
          }
        >
          <StudioBandContext.Provider value={isSplit ? bandNode : null}>
            <UnderTrailContext.Provider value={isUnderTrail}>{children}</UnderTrailContext.Provider>
          </StudioBandContext.Provider>
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
        data-studio-title={title}
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
            main={
              <div className="flex min-h-0 min-w-0 flex-1">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">{framed}</div>
                <DrawerEdgeContext.Provider value={shellEdge}>
                  <ShellToolRail />
                </DrawerEdgeContext.Provider>
              </div>
            }
            drawer={
              drawerSpec?.node == null || !isPanelShown ? null : (
                <UnderTrailContext.Provider value={isUnderTrail}>
                  {drawerSpec.node}
                </UnderTrailContext.Provider>
              )
            }
            ariaLabel={drawerSpec?.ariaLabel ?? 'Side panel'}
            resizeLabel={drawerSpec?.resizeLabel ?? 'Resize side panel'}
            {...(drawerSpec?.drawerKey !== undefined && { drawerKey: drawerSpec.drawerKey })}
            {...(drawerSpec?.drawerRef !== undefined && { drawerRef: drawerSpec.drawerRef })}
            {...(drawerSpec?.sizing !== undefined && { sizing: drawerSpec.sizing })}
          />
        ) : (
          framed
        )}
      </div>
    </StudioFrameContext.Provider>
  );
};
