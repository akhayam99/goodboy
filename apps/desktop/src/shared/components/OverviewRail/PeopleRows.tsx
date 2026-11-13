import { cn } from '@goodboy/ui';
import { Person } from '../Person';
import { PROPERTY_ROW } from './propertyRow';
import { PropertyField } from './PropertyField';

export type PersonRow = {
  readonly login: string;
  readonly avatarUrl: string | null;
  readonly isBot: boolean;
  readonly note: string;
};

type Props = {
  readonly rows: ReadonlyArray<PersonRow>;
};

export const PeopleRows = ({ rows }: Props) => {
  if (rows.length === 0) {
    return null;
  }
  return (
    <PropertyField label="People">
      <ul className="flex min-w-0 flex-col">
        {rows.map((row) => (
          <li
            key={row.login}
            {...(row.isBot ? { 'data-person-note': 'bot' } : {})}
            className={cn(PROPERTY_ROW, 'justify-between')}
          >
            <Person login={row.login} avatarUrl={row.avatarUrl} size="sm" isBot={row.isBot} />
            <span className="shrink-0 text-meta text-muted-foreground">{row.note}</span>
          </li>
        ))}
      </ul>
    </PropertyField>
  );
};
