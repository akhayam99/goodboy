import { useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { Chip, EmptyLine, IconButton } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ReviewerPicker } from '../../../../shared/components/ReviewerPicker';
import type { SearchReviewers } from './types';

type Props = {
  readonly sessionId: SessionId;
  readonly logins: ReadonlyArray<string>;
  readonly search: SearchReviewers;
  readonly onChange: (logins: ReadonlyArray<string>) => void;
};

export const ReviewerChips = ({ sessionId, logins, search, onChange }: Props) => {
  const exclude = useMemo(() => new Set(logins.map((login) => login.toLowerCase())), [logins]);
  const onAdd = useCallback(
    (added: ReadonlyArray<string>) => {
      onChange([...logins, ...added.filter((login) => !exclude.has(login.toLowerCase()))]);
    },
    [exclude, logins, onChange],
  );
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {logins.length === 0 && <EmptyLine>None requested</EmptyLine>}
      {logins.map((login) => (
        <Chip
          key={login}
          tone="neutral"
          size="md"
          label={login}
          trailing={
            <IconButton
              icon={X}
              size="xs"
              iconSize={ICON_SIZE.row}
              label={`Remove ${login}`}
              onClick={() => onChange(logins.filter((candidate) => candidate !== login))}
            />
          }
        />
      ))}
      <ReviewerPicker
        search={search}
        exclude={exclude}
        openEventName={`create-review-reviewers:${sessionId}`}
        onAdd={onAdd}
      />
    </div>
  );
};
