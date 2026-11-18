import type { KeyboardEvent } from 'react';
import { TitleField } from '../../../../../shared/components/TitleField';
import { SessionRowTitle } from '../../SessionRowTitle';

type CardRename = {
  readonly draft: string;
  readonly maxLength: number;
  readonly used: number;
  readonly limit: number;
  readonly error: string | null;
  readonly canRetry: boolean;
  readonly isPending: boolean;
  readonly commit: () => Promise<void>;
  readonly setDraft: (draft: string) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly onBlur: () => void;
};

type Props = {
  readonly rename: CardRename;
  readonly keys: ReadonlyArray<string>;
};

export const CardRenameField = ({ rename, keys }: Props) => (
  <span onClick={(event) => event.stopPropagation()} className="min-w-0 self-start">
    <TitleField
      density="row"
      ariaLabel="Session title"
      draft={rename.draft}
      maxLength={rename.maxLength}
      used={rename.used}
      limit={rename.limit}
      error={rename.error}
      canRetry={rename.canRetry}
      isPending={rename.isPending}
      onRetry={() => void rename.commit()}
      lead={
        keys.length === 0 ? null : <SessionRowTitle keys={keys} title="" className="shrink-0" />
      }
      onDraftChange={rename.setDraft}
      onKeyDown={rename.onKeyDown}
      onBlur={rename.onBlur}
    />
  </span>
);
