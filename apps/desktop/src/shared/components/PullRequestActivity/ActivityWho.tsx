type Props = {
  readonly login: string | null;
};

const MISSING_LOGIN = 'Someone';

export const ActivityWho = ({ login }: Props) => (
  <span className="text-row-strong text-foreground">
    {login === null || login === '' ? MISSING_LOGIN : login}
  </span>
);
