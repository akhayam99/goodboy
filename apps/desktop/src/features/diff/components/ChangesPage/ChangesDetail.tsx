import type { ReactNode } from 'react';
import { cn, PageColumn } from '@goodboy/ui';

type Props = {
  readonly isFramed: boolean;
  readonly isDiffShown: boolean;
  readonly toolbar: ReactNode;
  readonly diffView: ReactNode;
  readonly plainBody: ReactNode;
  readonly fileReader: ReactNode | null;
};

type ColumnParams = {
  readonly children: ReactNode;
};

export const ChangesDetail = ({
  isFramed,
  isDiffShown,
  toolbar,
  diffView,
  plainBody,
  fileReader,
}: Props) => {
  const isReading = fileReader !== null;
  const columnOf = ({ children }: ColumnParams) =>
    isFramed ? (
      <PageColumn width="column" className="flex min-h-0 flex-1 flex-col">
        {children}
      </PageColumn>
    ) : (
      children
    );
  return (
    <div data-changes-diff="" className="flex h-full min-h-0 min-w-0 flex-col">
      {isDiffShown && !isReading ? null : toolbar}
      <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', isReading && 'hidden')}>
        {isDiffShown ? diffView : columnOf({ children: plainBody })}
      </div>
      {fileReader === null ? null : columnOf({ children: fileReader })}
    </div>
  );
};
