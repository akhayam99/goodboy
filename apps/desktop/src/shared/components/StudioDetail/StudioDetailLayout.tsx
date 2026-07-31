import type { ReactNode } from 'react';
import { Divider, ScrollFade } from '@goodboy/ui';

type Props = {
  readonly header: ReactNode;
  readonly rail?: ReactNode;
  readonly tabs?: ReactNode;
  readonly scrolls?: boolean;
  readonly children: ReactNode;
};

export const StudioDetailLayout = ({ header, rail, tabs, scrolls = true, children }: Props) => {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-3 px-6 py-4">
        {header}
        {tabs}
      </div>
      <Divider />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {scrolls ? (
          <ScrollFade
            className="h-full min-h-0 min-w-0 flex-1"
            viewportClassName="px-6 py-6"
            fadeSize={24}
          >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">{children}</div>
          </ScrollFade>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        )}
        {rail != null ? (
          <div className="flex min-h-0 shrink-0 flex-col lg:flex-row">
            <Divider className="lg:hidden" />
            <Divider orientation="vertical" className="hidden lg:block" />
            <ScrollFade
              className="max-h-64 w-full lg:h-full lg:max-h-none lg:w-80"
              viewportClassName="p-4"
              fadeSize={24}
            >
              <div className="flex flex-col gap-4">{rail}</div>
            </ScrollFade>
          </div>
        ) : null}
      </div>
    </div>
  );
};
