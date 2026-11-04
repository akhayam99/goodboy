import { Checkbox, Input } from '@goodboy/ui';
import type { ProjectCandidate } from './projectCandidate';

type Props = {
  readonly shown: ReadonlyArray<ProjectCandidate>;
  readonly picked: ReadonlyArray<string>;
  readonly isDisabled: boolean;
  readonly hasInSession: boolean;
  readonly isSearchOpen: boolean;
  readonly query: string;
  readonly onToggle: (params: Pick<ProjectCandidate, 'key'>) => void;
  readonly onQuery: (value: string) => void;
};

export const ProjectPickList = ({
  shown,
  picked,
  isDisabled,
  hasInSession,
  isSearchOpen,
  query,
  onToggle,
  onQuery,
}: Props) => (
  <div className="flex min-w-0 flex-col gap-1">
    {hasInSession ? <p className="text-eyebrow text-muted-foreground">In this session</p> : null}
    <ul aria-label="Projects" className="flex min-w-0 flex-col">
      {shown.map((candidate) => (
        <li key={candidate.key} className="flex h-7 min-w-0 items-center gap-2">
          <Checkbox
            checked={picked.includes(candidate.key)}
            disabled={isDisabled}
            ariaLabel={candidate.name}
            onChange={() => onToggle({ key: candidate.key })}
            label={
              <span className="flex min-w-0 items-center gap-2 text-ui">
                <span className="text-foreground">{candidate.name}</span>
                <span className="truncate text-faint-foreground">{candidate.line}</span>
              </span>
            }
          />
        </li>
      ))}
    </ul>
    {isSearchOpen ? (
      <Input
        aria-label="Type a folder name"
        placeholder="Type a folder name"
        value={query}
        disabled={isDisabled}
        onChange={(event) => onQuery(event.target.value)}
      />
    ) : null}
  </div>
);
