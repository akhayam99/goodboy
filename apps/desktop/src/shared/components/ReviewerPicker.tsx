import { useEffect, useState } from 'react';
import {
  AnchoredPopover,
  Avatar,
  EmptyState,
  IconButton,
  ROW_INTERACTIVE,
  ScrollFade,
  cn,
  Skeleton,
  useDropdown,
} from '@goodboy/ui';
import { Plus, Search } from 'lucide-react';
import type { PullRequestPerson } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly search: (query: string) => Promise<ReadonlyArray<PullRequestPerson>>;
  readonly exclude: ReadonlySet<string>;
  readonly openEventName: string;
  readonly onAdd: (logins: ReadonlyArray<string>) => void;
};

const MAX_CANDIDATES = 8;

export const ReviewerPicker = ({ search, exclude, openEventName, onAdd }: Props) => {
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<ReadonlyArray<PullRequestPerson> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const dropdown = useDropdown({ width: 'w-60', expectedHeight: 220 });
  const { open: isOpen, close, toggle } = dropdown;

  useEffect(() => {
    const onOpen = () => {
      if (!isOpen) {
        toggle();
      }
    };
    window.addEventListener(openEventName, onOpen);
    return () => window.removeEventListener(openEventName, onOpen);
  }, [isOpen, openEventName, toggle]);

  useEffect(() => {
    if (!isOpen || people !== null) {
      return;
    }
    setIsLoading(true);
    void search('')
      .then(setPeople)
      .catch(() => setPeople([]))
      .finally(() => setIsLoading(false));
  }, [isOpen, people, search]);

  const needle = query.trim().toLowerCase();
  const candidates = (people ?? [])
    .filter((person) => !exclude.has(person.login.toLowerCase()))
    .filter((person) => person.login.toLowerCase().includes(needle))
    .slice(0, MAX_CANDIDATES);

  return (
    <AnchoredPopover
      dropdown={dropdown}
      className="flex flex-col gap-1 p-2"
      anchorClassName="shrink-0"
      trigger={
        <IconButton
          icon={Plus}
          size="xs"
          label="Request review"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={toggle}
        />
      }
    >
      <div className="flex items-center gap-2 px-2 py-1">
        <Search size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="filter collaborators"
          className="w-full bg-transparent text-label text-foreground outline-none placeholder:text-faint-foreground"
        />
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-1 px-2 py-1" role="status" aria-label="Loading">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex items-center gap-2">
              <Skeleton className="size-4 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <EmptyState size="section" icon={CONCEPT_ICONS.search} title="No matches" />
      ) : (
        <ScrollFade className="max-h-44" fadeSize={16}>
          <ul>
            {candidates.map((person) => (
              <li key={person.login}>
                <button
                  type="button"
                  onClick={() => {
                    onAdd([person.login]);
                    close();
                    setQuery('');
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-label text-foreground',
                    ROW_INTERACTIVE,
                  )}
                >
                  <Avatar url={person.avatarUrl} alt={person.login} size="xs" />
                  <span className="min-w-0 flex-1 truncate">{person.login}</span>
                </button>
              </li>
            ))}
          </ul>
        </ScrollFade>
      )}
    </AnchoredPopover>
  );
};
