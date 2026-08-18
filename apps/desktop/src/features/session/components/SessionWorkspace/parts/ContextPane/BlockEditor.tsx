import { Textarea } from '@goodboy/ui';

type Props = {
  readonly value: string;
  readonly label: string;
  readonly minRows?: number;
  readonly onChange: (next: string) => void;
  readonly onCommit: () => void;
  readonly onCancel: () => void;
};

export const BlockEditor = ({ value, label, minRows = 3, onChange, onCommit, onCancel }: Props) => (
  <Textarea
    autoFocus
    aria-label={label}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    onBlur={onCommit}
    onKeyDown={(event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onCommit();
      }
    }}
    className="font-mono text-sm"
    autoGrow
    minRows={minRows}
    maxRows={24}
  />
);
