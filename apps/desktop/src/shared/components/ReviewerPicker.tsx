import { useEffect, useState } from 'react';
import {
  AnchoredPopover,
  Avatar,
  EmptyState,
  IconButton,
  PopoverPin,
  SearchField,
  SelectableRow,
  Skeleton,
  useDropdown,
} from '@goodboy/ui';
import { Plus } from '@goodboy/ui/icons';
import type { PullRequestPerson } from '@goodboy/types';
import { NAMES } from '../utils/names';
import { CONCEPT_ICONS } from './conceptIcons';

type Props = {
  readonly search: (query: string) => Promise<ReadonlyArray<PullRequestPerson>>;
  readonly exclude: ReadonlySet<string>;
  readonly openEventName: string;
  readonly onAdd: (logins: ReadonlyArray<string>) => void;
  readonly isBusy?: boolean;
};

const MAX_CANDIDATES = 8;

export const ReviewerPicker = ({
  search,
  exclude,
  openEventName,
  onAdd,
  isBusy = false,
}: Props) => {
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<ReadonlyArray<PullRequestPerson> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const dropdown = useDropdown({ width: 'w-60', expectedHeight: 220 });
  const { open: isOpen, close, toggle } = dropdown;

  useEffect(() => {
    const onOpen = () => {
      if (!isOpen && !isBusy) {
        toggle();
      }
    };
    window.addEventListener(openEventName, onOpen);
    return () => window.removeEventListener(openEventName, onOpen);
  }, [isBusy, isOpen, openEventName, toggle]);

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
      bodyClassName="max-h-44"
      anchorClassName="shrink-0"
      trigger={
        <IconButton
          icon={Plus}
          size="xs"
          label="Request review"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          busy={isBusy}
          onClick={toggle}
        />
      }
    >
      <PopoverPin edge="start" className="flex">
        <SearchField
          autoFocus
          value={query}
          onChange={setQuery}
          placeholder={NAMES.searchReviewers}
          ariaLabel={NAMES.searchReviewers}
        />
      </PopoverPin>
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
        <ul>
          {candidates.map((person) => (
            <li key={person.login}>
              <SelectableRow
                selected={false}
                onClick={() => {
                  onAdd([person.login]);
                  close();
                  setQuery('');
                }}
                className="items-center gap-2 px-2 py-1 text-meta text-foreground"
              >
                <Avatar url={person.avatarUrl} alt={person.login} size="xs" />
                <span className="min-w-0 flex-1 truncate">{person.login}</span>
              </SelectableRow>
            </li>
          ))}
        </ul>
      )}
    </AnchoredPopover>
  );
};
