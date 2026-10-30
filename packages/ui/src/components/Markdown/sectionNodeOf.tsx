import type { ReactNode } from 'react';

type Params = {
  readonly key: string;
  readonly blocks: ReadonlyArray<ReactNode>;
  readonly isHeadingSection: boolean;
};

export const sectionNodeOf = ({ key, blocks, isHeadingSection }: Params): ReactNode => {
  if (!isHeadingSection || blocks.length < 2) {
    return (
      <div key={key} className="flex flex-col gap-3">
        {blocks}
      </div>
    );
  }
  return (
    <div key={key} data-heading-section="" className="flex flex-col gap-2">
      {blocks[0]}
      <div className="flex flex-col gap-3">{blocks.slice(1)}</div>
    </div>
  );
};
