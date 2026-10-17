import { useContext, type ReactElement, type ReactNode } from 'react';
import { cn } from '../../cn';
import type { FramePage } from '../../frameGeometry';
import { PANE_RHYTHM } from '../../paneRhythm';
import { PageColumn, type PageColumnWidth } from '../PageColumn';
import { PaneTitleRow } from './PaneTitleRow';
import { UnderTrailContext } from './underTrailContext';
import { useInheritedPaneActions } from './paneActionsContext';
import { pageWidthOf } from './pageWidthOf';

type BaseProps = {
  readonly page?: FramePage;
  readonly width?: PageColumnWidth;
  readonly isOnColumn?: boolean;
  readonly rhythm?: 'title' | 'section';
  readonly tabs?: ReactNode;
  readonly animationClassName?: string;
};

type TitleProps = {
  readonly title: ReactNode;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
  readonly subheader?: ReactNode;
  readonly row?: undefined;
};

type RowProps = {
  readonly row: ReactElement;
  readonly title?: undefined;
  readonly meta?: undefined;
  readonly actions?: undefined;
  readonly subheader?: undefined;
};

export type PageHeaderProps = BaseProps & (TitleProps | RowProps);

export const PageHeader = (props: PageHeaderProps) => {
  const {
    page,
    width,
    isOnColumn = false,
    rhythm = 'title',
    tabs,
    animationClassName = 'motion-safe:animate-studio-in',
  } = props;
  const isUnderTrail = useContext(UnderTrailContext);
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
      className={cn(
        'flex min-w-0 shrink-0 flex-col',
        PANE_RHYTHM.below[rhythm],
        !isUnderTrail && PANE_RHYTHM.headerInset,
      )}
    >
      <div className={cn('flex min-w-0 flex-col gap-2', animationClassName)}>
        {props.row !== undefined ? (
          props.row
        ) : (
          <>
            <PaneTitleRow title={props.title} meta={props.meta} actions={titleActions} />
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
