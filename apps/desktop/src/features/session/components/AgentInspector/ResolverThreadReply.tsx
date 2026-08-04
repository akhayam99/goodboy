import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Markdown, SectionHeader, Textarea } from '@goodboy/ui';
import { GhostActionButton } from '../../../../shared/components/GhostActionButton';

type Props = {
  readonly label: string;
  readonly value: string;
  readonly placeholder: string;
  readonly ariaLabel: string;
  readonly isEditable: boolean;
  readonly onChange: (next: string) => void;
  readonly onCommit: () => void;
};

export const ResolverThreadReply = ({
  label,
  value,
  placeholder,
  ariaLabel,
  isEditable,
  onChange,
  onCommit,
}: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const commit = () => {
    setIsEditing(false);
    onCommit();
  };

  return (
    <section className="flex flex-col gap-1">
      <SectionHeader
        label={label}
        action={
          isEditable && !isEditing ? (
            <GhostActionButton
              icon={Pencil}
              label="Edit"
              ariaLabel={`Edit ${ariaLabel.charAt(0).toLowerCase()}${ariaLabel.slice(1)}`}
              onClick={() => setIsEditing(true)}
            />
          ) : null
        }
      />
      {isEditing ? (
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') {
              return;
            }
            event.preventDefault();
            commit();
          }}
          aria-label={ariaLabel}
          placeholder={placeholder}
          autoFocus
          autoGrow
          maxRows={12}
          className="resize-none bg-background/60 px-2 py-1.5 text-xs leading-relaxed"
        />
      ) : (
        <div className="rounded-md border border-border-soft bg-background/40 px-2 py-1.5">
          {value.trim() === '' ? (
            <p className="text-2xs italic leading-relaxed text-muted-foreground/60">
              {placeholder}
            </p>
          ) : (
            <Markdown text={value} className="gap-1 text-xs leading-relaxed text-foreground/85" />
          )}
        </div>
      )}
    </section>
  );
};
