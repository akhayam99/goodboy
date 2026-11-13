import { Bot } from 'lucide-react';
import { Avatar, cn, ICON_SIZE, tintClasses } from '@goodboy/ui';

type PersonSize = 'xs' | 'sm' | 'md';

type Props = {
  readonly login: string | null;
  readonly avatarUrl: string | null;
  readonly size?: PersonSize;
  readonly isBot?: boolean;
  readonly isNameHidden?: boolean;
};

const MISSING_LOGIN = 'Someone';

const TILE_CLASS: Record<PersonSize, string> = {
  xs: 'size-4',
  sm: 'size-5',
  md: 'size-6',
};

const NAME_CLASS: Record<PersonSize, string> = {
  xs: 'text-meta',
  sm: 'text-row',
  md: 'text-row',
};

export const Person = ({
  login,
  avatarUrl,
  size = 'sm',
  isBot = false,
  isNameHidden = false,
}: Props) => {
  const name = login === null || login === '' ? MISSING_LOGIN : login;
  const tint = tintClasses('neutral');

  return (
    <span
      data-person=""
      data-person-size={size}
      data-person-kind={isBot ? 'bot' : 'human'}
      className="inline-flex min-w-0 items-center gap-1"
    >
      {isBot ? (
        <span
          aria-hidden
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-md',
            TILE_CLASS[size],
            tint.bg,
            tint.icon,
          )}
        >
          <Bot size={ICON_SIZE.row} />
        </span>
      ) : (
        <Avatar
          url={login === null || login === '' ? null : avatarUrl}
          alt=""
          size={size}
          initialsSource={login ?? ''}
        />
      )}
      {isNameHidden ? null : (
        <span className={cn('min-w-0 truncate text-foreground', NAME_CLASS[size])}>{name}</span>
      )}
    </span>
  );
};
