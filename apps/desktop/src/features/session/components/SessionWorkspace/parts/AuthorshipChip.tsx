import { Chip } from '@goodboy/ui';

type Props = {
  readonly byUser: boolean;
};

export const AuthorshipChip = ({ byUser }: Props) => (
  <Chip
    tone={byUser ? 'primary' : 'info'}
    size="sm"
    bordered={false}
    label={byUser ? 'You' : 'Agent'}
  />
);
