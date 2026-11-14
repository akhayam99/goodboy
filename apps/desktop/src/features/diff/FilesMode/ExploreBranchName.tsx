import { cn, TruncatedText } from '@goodboy/ui';

type Props = {
  readonly branch: string;
  readonly className?: string;
};

export const ExploreBranchName = ({ branch, className }: Props) => (
  <TruncatedText className={cn('min-w-0 text-code', className)}>{branch}</TruncatedText>
);
