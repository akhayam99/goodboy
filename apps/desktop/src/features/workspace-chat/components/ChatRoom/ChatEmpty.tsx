import { CornerDownLeft } from 'lucide-react';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly workspaceName: string;
  readonly projectNames: ReadonlyArray<string>;
  readonly suggestions: ReadonlyArray<string>;
  readonly onAsk: (question: string) => void;
};

const ChatIcon = CONCEPT_ICONS.chat;

type ListParams = {
  readonly names: ReadonlyArray<string>;
};

const joinNames = ({ names }: ListParams): string => {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

export const ChatEmpty = ({ workspaceName, projectNames, suggestions, onAsk }: Props) => (
  <div className="flex w-full max-w-md flex-col items-start gap-4 py-12">
    <span className="flex size-8 items-center justify-center rounded-lg border border-border-soft bg-subtle text-muted-foreground">
      <ChatIcon size={ICON_SIZE.control} aria-hidden />
    </span>
    <div className="flex flex-col gap-1">
      <h2 className="text-title text-foreground">{`Ask anything about ${workspaceName}`}</h2>
      <p className="text-body text-muted-foreground">
        {projectNames.length === 0
          ? 'Add a project to this workspace so answers can read its code. Nothing gets changed.'
          : `Answers read the code and history of ${joinNames({ names: projectNames })}. Nothing gets changed. Off-topic questions are fine too.`}
      </p>
    </div>
    {projectNames.length === 0 ? null : (
      <ul aria-label="Suggested questions" className="flex w-full flex-col gap-1.5">
        {suggestions.map((suggestion) => (
          <li key={suggestion}>
            <button
              type="button"
              onClick={() => onAsk(suggestion)}
              className="group flex w-full items-center gap-2 rounded-lg border border-border-soft bg-subtle px-2.5 py-2 text-left text-label text-foreground motion-safe:transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <ChatIcon
                size={ICON_SIZE.row}
                aria-hidden
                className="shrink-0 text-faint-foreground"
              />
              <span className="min-w-0 flex-1 truncate">{suggestion}</span>
              <CornerDownLeft
                size={ICON_SIZE.row}
                aria-hidden
                className="shrink-0 text-faint-foreground opacity-0 motion-safe:transition-opacity group-hover:opacity-100"
              />
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
);
