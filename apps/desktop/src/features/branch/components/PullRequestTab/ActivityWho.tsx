import { Person } from '../../../../shared/components/Person';

type Props = {
  readonly login: string | null;
  readonly avatarUrl: string | null;
  readonly isBot?: boolean;
};

export const ActivityWho = ({ login, avatarUrl, isBot = false }: Props) => (
  <span className="align-middle">
    <Person login={login} avatarUrl={avatarUrl} size="md" isBot={isBot} />
  </span>
);
