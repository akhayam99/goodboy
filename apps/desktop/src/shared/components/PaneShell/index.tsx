import { useContext, type ReactElement, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Divider, PageColumn, ScrollFade, cn, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import { PANE_RHYTHM } from '@goodboy/ui';
import { PaneTitleRow } from './PaneTitleRow';
import { UnderTrailContext } from './underTrailContext';
import { PaneActionsContext, useInheritedPaneActions } from './paneActionsContext';

type BaseProps = {
  readonly animationClassName?: string;
  readonly scroll?: 'pane' | 'body' | 'self';
  readonly tabs?: ReactNode;
  readonly dock?: ReactNode;
  readonly children: ReactNode;
};

type TitleHeaderProps = {
  readonly title: string;
  readonly icon?: LucideIcon;
  readonly glyph?: ReactNode;
  readonly tone?: Tone;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
  readonly header?: undefined;
};

type CustomHeaderProps = {
  readonly header: ReactElement;
  readonly title?: undefined;
  readonly icon?: undefined;
  readonly glyph?: undefined;
  readonly tone?: undefined;
  readonly meta?: undefined;
  readonly actions?: undefined;
};

type Props = BaseProps & (TitleHeaderProps | CustomHeaderProps);

export const PaneShell = (props: Props) => {
  const {
    animationClassName = 'motion-safe:animate-studio-in',
    scroll = 'pane',
    tabs,
    dock,
    children: content,
  } = props;
  const isUnderTrail = useContext(UnderTrailContext);
  const inheritedActions = useInheritedPaneActions();
  const children = (
    <PaneActionsContext.Provider value={null}>{content}</PaneActionsContext.Provider>
  );
  const titleActions =
    inheritedActions == null ? (
      props.actions
    ) : (
      <>
        {props.actions}
        {inheritedActions}
      </>
    );

  const iconNode =
    props.glyph != null ? (
      <span aria-hidden className="flex shrink-0 translate-y-0.5">
        {props.glyph}
      </span>
    ) : props.icon != null ? (
      <props.icon
        size={16}
        aria-hidden
        className={cn('shrink-0 translate-y-0.5', tintClasses(props.tone ?? 'neutral').icon)}
      />
    ) : null;

  const header = (
    <div
      data-slot="pane-header"
      className={cn('flex min-w-0 shrink-0 flex-col pb-4', !isUnderTrail && 'pt-3')}
    >
      <div className={cn('flex min-w-0 flex-col gap-2', animationClassName)}>
        {props.header !== undefined ? (
          props.header
        ) : (
          <PaneTitleRow
            title={props.title}
            icon={iconNode}
            meta={props.meta}
            actions={titleActions}
          />
        )}
        {tabs != null ? <div className="flex min-w-0 items-center">{tabs}</div> : null}
      </div>
    </div>
  );

  const dockBlock =
    dock != null ? (
      <>
        <Divider />
        <div data-slot="pane-dock" className="shrink-0">
          <PageColumn className="flex flex-col py-4">{dock}</PageColumn>
        </div>
      </>
    ) : null;

  if (scroll === 'pane') {
    return (
      <div className="@container flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
          <PageColumn className="flex flex-col pb-5">
            {header}
            <div data-slot="pane-body" className={cn(PANE_RHYTHM.stack, animationClassName)}>
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
        <PageColumn>{header}</PageColumn>
      </div>
      {scroll === 'self' ? (
        <div data-slot="pane-body" className="flex min-h-0 min-w-0 flex-1 flex-col">
          {children}
        </div>
      ) : (
        <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
          <PageColumn className="pb-5">
            <div data-slot="pane-body" className={cn(PANE_RHYTHM.stack, animationClassName)}>
              {children}
            </div>
          </PageColumn>
        </ScrollFade>
      )}
      {dockBlock}
    </div>
  );
};
