import { useRef, useState } from 'react';
import { cn } from '@goodboy/ui';
import type { AgentRole } from '@goodboy/types';
import { Check, ChevronDown } from 'lucide-react';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { AGENT_ROLES, ROLE_LABEL, ROLE_TO_KIND } from '../../agent-kind';
import { POPUP_BASE, POPUP_DOWN, POPUP_UP } from '../dropdown-utils';
import { useClickOutside } from '../../../../shared/hooks/useClickOutside';
import { useDropdownDirection } from '../../../../shared/hooks/useDropdownDirection';

interface Props {
  value: AgentRole;
  onChange: (role: AgentRole) => void;
  disabled: boolean;
}

export function RoleSelect({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));
  const direction = useDropdownDirection(containerRef, open);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
          open
            ? 'border-primary bg-primary/5'
            : 'border-border-soft bg-subtle hover:border-border hover:bg-muted/50',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <AgentAvatar kind={ROLE_TO_KIND[value]} size="xs" />
        <span className="flex-1 truncate font-medium text-foreground">{ROLE_LABEL[value]}</span>
        <ChevronDown
          size={11}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          className={cn(
            POPUP_BASE,
            'max-h-64 min-w-[10rem] overflow-y-auto',
            direction === 'up' ? POPUP_UP : POPUP_DOWN,
          )}
        >
          {AGENT_ROLES.map((role) => {
            const active = value === role;
            return (
              <button
                key={role}
                type="button"
                onClick={() => {
                  onChange(role);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs transition-colors',
                  active
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <AgentAvatar kind={ROLE_TO_KIND[role]} size="xs" />
                <span className="flex-1 truncate">{ROLE_LABEL[role]}</span>
                {active ? <Check size={11} className="shrink-0 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
