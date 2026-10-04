type Props = {
  readonly fromTask: string;
  readonly withoutTask: string;
  readonly isValid: boolean;
  readonly note: string;
};

const NOT_VALID = 'Not valid yet';

export const BranchTemplatePreview = ({ fromTask, withoutTask, isValid, note }: Props) => (
  <div
    aria-live="polite"
    aria-label="Branch name preview"
    className="flex flex-col gap-2 rounded-md border border-border px-3 py-3"
  >
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-6 gap-y-1">
      <dt className="text-meta text-muted-foreground">From a task</dt>
      <dd
        className={
          isValid ? 'truncate font-mono text-code text-foreground' : 'text-label text-danger'
        }
      >
        {isValid ? fromTask : NOT_VALID}
      </dd>
      <dt className="text-meta text-muted-foreground">Without a task</dt>
      <dd
        className={
          isValid ? 'truncate font-mono text-code text-foreground' : 'text-label text-danger'
        }
      >
        {isValid ? withoutTask : NOT_VALID}
      </dd>
    </dl>
    <p className="text-meta text-muted-foreground">{note}</p>
  </div>
);
