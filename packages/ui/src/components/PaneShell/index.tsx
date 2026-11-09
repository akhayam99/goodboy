import { useContext, type ReactElement, type ReactNode } from 'react';
import type { FramePage } from '../../frameGeometry';
import { Divider } from '../Divider';
import { PageColumn, type PageColumnWidth } from '../PageColumn';
import { PageHeader } from './PageHeader';
import { pageWidthOf } from './pageWidthOf';
import { PaneActionsContext } from './paneActionsContext';
import { PaneBannerContext } from './paneBannerContext';
import { PageTrailContext } from './pageTrailContext';
import { RevealPane } from './RevealPane';

type BaseProps = {
  readonly animationClassName?: string;
  readonly scroll?: 'body' | 'self';
  readonly revealKey?: string;
  readonly tabs?: ReactNode;
  readonly dock?: ReactNode;
  readonly dockEdge?: 'line' | 'space';
  readonly lead?: ReactNode;
  readonly isHeaderPinned?: boolean;
  readonly headerRhythm?: 'title' | 'section';
  readonly page?: FramePage;
  readonly width?: PageColumnWidth;
  readonly children: ReactNode;
};

type TitleHeaderProps = {
  readonly title: ReactNode;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
  readonly subheader?: ReactNode;
  readonly header?: undefined;
};

type CustomHeaderProps = {
  readonly header: ReactElement;
  readonly title?: undefined;
  readonly meta?: undefined;
  readonly actions?: undefined;
  readonly subheader?: undefined;
};

type Props = BaseProps & (TitleHeaderProps | CustomHeaderProps);

export const PaneShell = (props: Props) => {
  const {
    animationClassName = 'motion-safe:animate-studio-in',
    scroll = 'body',
    revealKey,
    tabs,
    dock,
    dockEdge = 'line',
    lead,
    isHeaderPinned = false,
    headerRhythm = 'title',
    page,
    width: widthOverride,
    children: content,
  } = props;
  const width = pageWidthOf({ page, width: widthOverride });
  const inheritedBanner = useContext(PaneBannerContext);
  const banner =
    inheritedBanner == null ? null : (
      <div data-slot="pane-banner" className="min-w-0 shrink-0 empty:hidden">
        {inheritedBanner}
      </div>
    );
  const children = (
    <PaneActionsContext.Provider value={null}>
      <PaneBannerContext.Provider value={null}>
        <PageTrailContext.Provider value={null}>{content}</PageTrailContext.Provider>
      </PaneBannerContext.Provider>
    </PaneActionsContext.Provider>
  );
  const headerAnimation = isHeaderPinned ? '' : animationClassName;
  const header =
    props.header !== undefined ? (
      <PageHeader
        isOnColumn
        isTrailPinned
        isPinned={isHeaderPinned}
        rhythm={headerRhythm}
        tabs={tabs}
        animationClassName={headerAnimation}
        row={props.header}
        {...(page !== undefined && { page })}
      />
    ) : (
      <PageHeader
        isOnColumn
        isTrailPinned
        isPinned={isHeaderPinned}
        rhythm={headerRhythm}
        tabs={tabs}
        animationClassName={headerAnimation}
        title={props.title}
        meta={props.meta}
        actions={props.actions}
        subheader={props.subheader}
        {...(page !== undefined && { page })}
      />
    );

  const dockBlock =
    dock != null ? (
      <>
        {dockEdge === 'line' ? <Divider /> : null}
        <div data-slot="pane-dock" data-dock-edge={dockEdge} className="shrink-0">
          <PageColumn width={width} className="flex flex-col py-4">
            {dock}
          </PageColumn>
        </div>
      </>
    ) : null;

  return (
    <RevealPane
      width={width}
      header={header}
      banner={banner}
      lead={lead}
      isHeaderPinned={isHeaderPinned}
      dockBlock={dockBlock}
      isSelfScroll={scroll === 'self'}
      resetKey={revealKey ?? null}
      animationClassName={animationClassName}
    >
      {children}
    </RevealPane>
  );
};
