import { SectionHeader, StatusDot } from '@goodboy/ui';

type Props = {
  readonly files: ReadonlyArray<string>;
  readonly requestNoun: string;
};

export const BranchConflicts = ({ files, requestNoun }: Props) => (
  <section aria-label="Conflicts" data-branch-conflicts="" className="flex min-w-0 flex-col gap-3">
    <SectionHeader label="Conflicts" headingLevel={2} />
    {files.length === 0 ? null : (
      <ul className="flex min-w-0 flex-col">
        {files.map((path) => (
          <li key={path} className="flex min-h-7 min-w-0 items-center gap-3 text-label">
            <StatusDot tone="warning" size="sm" />
            <span className="min-w-0 flex-1 truncate text-code text-foreground">{path}</span>
          </li>
        ))}
      </ul>
    )}
    <p className="text-meta text-faint-foreground">
      {`The ${requestNoun} form comes back when the rebase is done.`}
    </p>
  </section>
);
