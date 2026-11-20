import { EmptyState, type EmptyStateProps, type IllustrationProps } from './EmptyState';

type Props = IllustrationProps &
  Omit<EmptyStateProps, keyof IllustrationProps | 'bordered' | 'size'> & {
    readonly description?: string;
  };

export const FilledEmptyState = ({ ...props }: Props) => <EmptyState {...props} size="section" />;
