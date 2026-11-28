import { Avatar, SectionLabel, TruncatedText } from '@goodboy/ui';

type Props = {
  readonly people: ReadonlyArray<string>;
};

export const EventPeople = ({ people }: Props) => (
  <section aria-label="People" className="flex min-w-0 flex-col gap-2">
    <SectionLabel label="People" headingLevel={3} count={people.length} />
    <ul className="flex min-w-0 flex-col gap-1">
      {people.map((name, index) => (
        <li key={`${index}-${name}`} className="flex min-h-7 min-w-0 items-center gap-2">
          <Avatar url={null} alt={name} size="xs" />
          <TruncatedText className="min-w-0 text-meta text-foreground">{name}</TruncatedText>
        </li>
      ))}
    </ul>
  </section>
);
