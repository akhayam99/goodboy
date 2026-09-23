export type GoalPresence = 'own' | 'title' | 'empty';

type Params = {
  readonly value: string;
  readonly sessionTitle: string;
};

export const goalPresence = ({ value, sessionTitle }: Params): GoalPresence => {
  if (value === '') {
    return 'empty';
  }
  return value.trim() === sessionTitle.trim() ? 'title' : 'own';
};
