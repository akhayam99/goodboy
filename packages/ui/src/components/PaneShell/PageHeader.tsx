import { useContext, type ReactElement, type ReactNode } from 'react';
import { cn } from '../../cn';
import type { FramePage } from '../../frameGeometry';
import { PANE_RHYTHM } from '../../paneRhythm';
import { PageColumn, type PageColumnWidth } from '../PageColumn';
import { PaneTitleRow } from './PaneTitleRow';
import { PageTrailContext } from './pageTrailContext';
import { UnderTrailContext } from './underTrailContext';
import { useInheritedPaneActions } from './paneActionsContext';
import { useInheritedPaneTabs } from './paneTabsContext';
import { pageWidthOf } from './pageWidthOf';

type BaseProps = {
  readonly page?: FramePage;
  readonly width?: PageColumnWidth;
  readonly isOnColumn?: boolean;
  readonly isTrailPinned?: boolean;
  readonly isPinned?: boolean;
  readonly rhythm?: 'title' | 'section';
  readonly tabs?: ReactNode;
  readonly animationClassName?: string;
};

type TitleProps = {
  readonly title: ReactNode;
  readonly badge?: ReactNode;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
  readonly toolbar?: ReactNode;
  readonly subheader?: ReactNode;
  readonly row?: undefined;
};

type RowProps = {
  readonly row: ReactElement;
  readonly title?: undefined;
  readonly badge?: undefined;
  readonly meta?: undefined;
  readonly actions?: undefined;
  readonly toolbar?: undefined;
  readonly subheader?: undefined;
};

export type PageHeaderProps = BaseProps & (TitleProps | RowProps);

export const PageHeader = (props: PageHeaderProps) => {
  const {
    page,
    width,
    isOnColumn = false,
    isTrailPinned = false,
    isPinned = false,
    rhythm = 'title',
    animationClassName = 'motion-safe:animate-studio-in',
  } = props;
  const inheritedTabs = useInheritedPaneTabs();
  const tabs = props.tabs ?? inheritedTabs;
  const isUnderTrail = useContext(UnderTrailContext);
  const trail = useContext(PageTrailContext);
  const isTrailInline = trail != null && !isTrailPinned;
  const inheritedActions = useInheritedPaneActions();
  const titleActions =
    inheritedActions == null ? (
      props.actions
    ) : (
      <>
        {props.actions}
        {inheritedActions}
      </>
    );
  const header = (
    <div
      data-slot="pane-header"
      data-page-header=""
      data-page={page}
      data-rhythm={rhythm}
      data-under-trail={isUnderTrail ? '' : undefined}
      data-pinned={isPinned ? '' : undefined}
      className={cn(
        'flex min-w-0 shrink-0 flex-col',
        !isPinned && PANE_RHYTHM.below[rhythm],
        !isPinned && !isUnderTrail && PANE_RHYTHM.headerInset,
      )}
    >
      <div
        className={cn(
          'flex min-w-0 flex-col',
          props.toolbar == null ? 'gap-2' : 'gap-0',
          animationClassName,
        )}
      >
        {isTrailInline ? (
          <div data-slot="page-trail" className="flex h-6 min-w-0 items-center">
            {trail}
          </div>
        ) : null}
        {props.row !== undefined ? (
          props.row
        ) : (
          <>
            <PaneTitleRow
              title={props.title}
              badge={props.badge}
              meta={props.meta}
              actions={titleActions}
            />
            {props.toolbar != null ? (
              <div data-slot="pane-toolbar" className="flex h-9 min-w-0 items-center">
                {props.toolbar}
              </div>
            ) : null}
            {props.subheader ?? null}
          </>
        )}
        {tabs != null ? <div className="flex min-w-0 items-center">{tabs}</div> : null}
      </div>
    </div>
  );
  if (isOnColumn) {
    return header;
  }
  return <PageColumn width={pageWidthOf({ page, width })}>{header}</PageColumn>;
};
