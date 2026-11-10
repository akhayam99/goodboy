import { BrandLockup } from './BrandLockup';

export type GoodboyChipState = 'update' | 'rest';

type Props = {
  readonly state: GoodboyChipState;
  readonly installedVersion: string | null;
  readonly isMarkOnly?: boolean;
};

export const GoodboyChipLabel = ({ state, installedVersion, isMarkOnly = false }: Props) => {
  if (isMarkOnly) {
    return <BrandLockup version={installedVersion} isMarkOnly />;
  }
  if (state === 'update') {
    return (
      <>
        <span data-lockup-wide="" className="contents @max-[12.25rem]:hidden">
          <BrandLockup version={installedVersion} hasMeta={false} />
        </span>
        <span data-lockup-narrow="" className="hidden @max-[12.25rem]:contents">
          <BrandLockup version={installedVersion} isMarkOnly />
        </span>
      </>
    );
  }
  return (
    <>
      <span data-lockup-wide="" className="contents @max-[13.5rem]:hidden">
        <BrandLockup version={installedVersion} />
      </span>
      <span data-lockup-narrow="" className="hidden @max-[13.5rem]:contents">
        <BrandLockup version={installedVersion} isMarkOnly />
      </span>
    </>
  );
};
