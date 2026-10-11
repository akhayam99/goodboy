import type { ReactNode } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { Button, ROW_INTERACTIVE, Skeleton, cn } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly workspaceName: string;
  readonly projectNames: ReadonlyArray<string>;
  readonly suggestions: ReadonlyArray<string>;
  readonly isLoading: boolean;
  readonly composer: ReactNode;
  readonly onAsk: (question: string) => void;
  readonly onAddProject: () => void;
};

const ChatIcon = CONCEPT_ICONS.chat;

const MAX_SUGGESTIONS = 3;

type ListParams = {
  readonly names: ReadonlyArray<string>;
};

const joinNames = ({ names }: ListParams): string => {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

export const ChatEmpty = ({
  workspaceName,
  projectNames,
  suggestions,
  isLoading,
  composer,
  onAsk,
  onAddProject,
}: Props) => {
  const hasProjects = projectNames.length > 0;
  return (
    <div
      data-chat-stage=""
      className="flex min-h-0 w-full flex-1 flex-col items-center justify-center motion-safe:-translate-y-6"
    >
      <div className="flex w-full flex-col items-center gap-4">
        <ChatIcon size={ICON_SIZE.control} aria-hidden className="text-muted-foreground" />
        {isLoading ? (
          <Skeleton className="h-3 w-48 rounded-sm" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-center">
            <h2 className="text-title text-foreground">{`Ask about ${workspaceName}`}</h2>
            <p className="text-body text-muted-foreground">
              {hasProjects
                ? `Answers read the code and history of ${joinNames({ names: projectNames })}.`
                : 'Add a project so answers can read its code.'}
            </p>
            {hasProjects ? null : (
              <Button variant="secondary" size="sm" onClick={onAddProject}>
                Add project
              </Button>
            )}
          </div>
        )}
        {composer}
        {hasProjects && !isLoading ? (
          <ul aria-label="Suggested questions" className="flex w-full flex-col">
            {suggestions.slice(0, MAX_SUGGESTIONS).map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onClick={() => onAsk(suggestion)}
                  className={cn(
                    'group flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-label text-muted-foreground hover:text-foreground',
                    ROW_INTERACTIVE,
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{suggestion}</span>
                  <CornerDownLeft
                    size={ICON_SIZE.row}
                    aria-hidden
                    className="shrink-0 text-faint-foreground opacity-0 motion-safe:transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
};
