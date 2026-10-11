import { X } from 'lucide-react';
import { Chip, IconButton } from '@goodboy/ui';
import type { ClosingIssueReference } from '../../github/closingIssueReferences';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly references: ReadonlyArray<ClosingIssueReference>;
  readonly onRemove: (reference: ClosingIssueReference) => void;
};

export const ClosesChips = ({ references, onRemove }: Props) => (
  <ul className="flex min-w-0 flex-wrap items-center gap-2">
    {references.map((reference) => (
      <li key={reference.number}>
        <Chip
          tone="neutral"
          size="md"
          label={reference.identifier}
          title={reference.line}
          trailing={
            <IconButton
              icon={X}
              size="xs"
              iconSize={ICON_SIZE.row}
              label={`Don't close ${reference.identifier}`}
              onClick={() => onRemove(reference)}
            />
          }
        />
      </li>
    ))}
  </ul>
);
