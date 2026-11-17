import { Button, cn, type ButtonProps } from '@goodboy/ui';

type Props = Omit<ButtonProps, 'variant' | 'size'>;

export const FactButton = ({ className, ...button }: Props) => (
  <Button size="xs" variant="fact" className={cn('px-1', className)} {...button} />
);
