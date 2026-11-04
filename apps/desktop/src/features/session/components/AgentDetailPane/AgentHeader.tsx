import type { ReactNode, Ref } from 'react';

type Props = {
  readonly title: ReactNode;
  readonly actions: ReactNode;
  readonly settings?: ReactNode;
  readonly meta?: ReactNode;
  readonly below?: ReactNode;
  readonly rootRef?: Ref<HTMLDivElement>;
};

export const AgentHeader = ({
  title,
  actions,
  settings = null,
  meta = null,
  below = null,
  rootRef,
}: Props) => {
  return (
    <div ref={rootRef} className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-col gap-1">
        <div
          data-testid="agent-header-title-row"
          data-slot="pane-title-row"
          className="flex min-h-8 min-w-0 items-center justify-between gap-4"
        >
          <div
            data-testid="agent-header-lead"
            className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1"
          >
            <h1 className="flex min-h-8 min-w-48 flex-1 items-center text-title text-foreground">
              {title}
            </h1>
            {settings === null ? null : (
              <div
                data-testid="agent-header-settings"
                className="flex min-w-0 max-w-full shrink items-center"
              >
                {settings}
              </div>
            )}
          </div>
          {actions != null ? (
            <div className="flex min-h-8 shrink-0 items-center gap-2 self-start">{actions}</div>
          ) : null}
        </div>
        {meta === null ? null : (
          <div
            data-testid="agent-header-meta"
            className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
          >
            {meta}
          </div>
        )}
      </div>
      {below}
    </div>
  );
};
