import { Chip } from '@goodboy/ui';

type Props = {
  readonly byUser: boolean;
};

export const AuthorshipChip = ({ byUser }: Props) => (
  <Chip
    tone={byUser ? 'accent' : 'info'}
    size="sm"
    uppercase
    bordered={false}
    label={byUser ? 'you' : 'agent'}
  />
);
