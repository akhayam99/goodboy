import type { WireframeIssue } from '@goodboy/core';
import { Button } from '@goodboy/ui';

type Props = {
  readonly issues: ReadonlyArray<WireframeIssue>;
  readonly sourceText: string;
  readonly isRepairing: boolean;
  readonly onRepair: () => void;
};

const prettyJson = (source: string): string => {
  try {
    return JSON.stringify(JSON.parse(source), null, 2);
  } catch {
    return source;
  }
};

export const WireframeIssues = ({ issues, sourceText, isRepairing, onRepair }: Props) => (
  <div data-testid="wireframe-issues" className="flex min-w-0 flex-col gap-3">
    <div className="flex flex-wrap items-center gap-2">
      <span role="alert" className="text-secondary text-danger">
        this wireframe does not match the schema, so it cannot be rendered
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={onRepair}
        disabled={isRepairing}
        data-testid="wireframe-repair"
        title="Run the wireframe again on the same evidence pack"
      >
        {isRepairing ? 'Starting' : 'Regenerate'}
      </Button>
    </div>
    <ul className="flex flex-col gap-1">
      {issues.slice(0, 20).map((issue) => (
        <li key={`${issue.path}-${issue.message}`} className="text-secondary text-muted-foreground">
          <span className="font-mono text-foreground">
            {issue.path.length === 0 ? 'root' : issue.path}
          </span>
          {': '}
          {issue.message}
        </li>
      ))}
    </ul>
    <pre
      data-testid="artifact-json-source"
      className="overflow-x-auto rounded-md border border-border-soft bg-elevated p-3 font-mono text-secondary text-foreground"
    >
      {prettyJson(sourceText)}
    </pre>
  </div>
);
