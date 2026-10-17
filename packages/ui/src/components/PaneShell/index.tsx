import { useContext, type ReactElement, type ReactNode } from 'react';
import { cn } from '../../cn';
import type { FramePage } from '../../frameGeometry';
import { PANE_RHYTHM } from '../../paneRhythm';
import { Divider } from '../Divider';
import { PageColumn, type PageColumnWidth } from '../PageColumn';
import { ScrollFade } from '../ScrollFade';
import { PageHeader } from './PageHeader';
import { pageWidthOf } from './pageWidthOf';
import { PaneActionsContext } from './paneActionsContext';
import { PaneBannerContext } from './paneBannerContext';

type BaseProps = {
  readonly animationClassName?: string;
  readonly scroll?: 'pane' | 'body' | 'self';
  readonly tabs?: ReactNode;
  readonly dock?: ReactNode;
  readonly dockEdge?: 'line' | 'space';
  readonly lead?: ReactNode;
  readonly headerRhythm?: 'title' | 'section';
  readonly page?: FramePage;
  readonly width?: PageColumnWidth;
  readonly children: ReactNode;
};

type TitleHeaderProps = {
  readonly title: string;
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
    scroll = 'pane',
    tabs,
    dock,
    dockEdge = 'line',
    lead,
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
      <PaneBannerContext.Provider value={null}>{content}</PaneBannerContext.Provider>
    </PaneActionsContext.Provider>
  );
  const header =
    props.header !== undefined ? (
      <PageHeader
        isOnColumn
        rhythm={headerRhythm}
        tabs={tabs}
        animationClassName={animationClassName}
        row={props.header}
        {...(page !== undefined && { page })}
      />
    ) : (
      <PageHeader
        isOnColumn
        rhythm={headerRhythm}
        tabs={tabs}
        animationClassName={animationClassName}
        title={props.title}
        meta={props.meta}
        actions={props.actions}
        subheader={props.subheader}
        {...(page !== undefined && { page })}
      />
    );

  const leadBlock =
    lead == null ? null : (
      <div data-slot="pane-lead" className="min-w-0 shrink-0 has-[[data-page-column]:empty]:hidden">
        <PageColumn width={width} className="flex flex-col gap-3 pb-3 empty:hidden">
          {lead}
        </PageColumn>
      </div>
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

  if (scroll === 'pane') {
    return (
      <div className="@container flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
          <PageColumn width={width} className="flex flex-col pb-5">
            {header}
            <div data-slot="pane-body" className={cn(PANE_RHYTHM.stack, animationClassName)}>
              {banner}
              {leadBlock}
              {children}
            </div>
          </PageColumn>
        </ScrollFade>
        {dockBlock}
      </div>
    );
  }

  return (
    <div className="@container flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="shrink-0 overflow-hidden">
        <PageColumn width={width}>{header}</PageColumn>
      </div>
      {scroll === 'self' ? (
        <div data-slot="pane-body" className="flex min-h-0 min-w-0 flex-1 flex-col">
          {banner === null ? null : (
            <PageColumn
              width={width}
              className="shrink-0 pb-3 has-[[data-slot=pane-banner]:empty]:hidden"
            >
              {banner}
            </PageColumn>
          )}
          {leadBlock}
          <div data-slot="pane-fill" className="flex min-h-0 min-w-0 flex-1 flex-col">
            {children}
          </div>
        </div>
      ) : (
        <ScrollFade className="min-h-0 flex-1" fadeSize={24} edge="line">
          <PageColumn width={width} className="pb-5">
            <div data-slot="pane-body" className={cn(PANE_RHYTHM.stack, animationClassName)}>
              {banner}
              {leadBlock}
              {children}
            </div>
          </PageColumn>
        </ScrollFade>
      )}
      {dockBlock}
    </div>
  );
};
