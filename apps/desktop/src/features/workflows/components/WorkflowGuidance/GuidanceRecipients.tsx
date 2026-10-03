import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import type { AgentRole } from '@goodboy/types';
import { Button, Chip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { GUIDANCE_ROLE_CHOICES, guidanceLeftOutText, guidanceRoleNames } from '../../guidanceRoles';

type Props = {
  readonly roles: ReadonlyArray<AgentRole>;
  readonly where?: string;
  readonly marker?: ReactNode;
  readonly disabled?: boolean;
  readonly onRoles: (roles: ReadonlyArray<AgentRole>) => void;
};

export const GuidanceRecipients = ({
  roles,
  where,
  marker = null,
  disabled = false,
  onRoles,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 text-secondary text-muted-foreground">
        <span>
          Sent to <span className="text-foreground">{guidanceRoleNames({ roles })}</span>
          {where === undefined ? null : ` ${where}`}
        </span>
        {marker}
        {disabled ? null : (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((open) => !open)}
          >
            {isOpen ? 'Done' : 'Edit'}
          </Button>
        )}
      </div>
      {isOpen && !disabled ? (
        <div
          className="flex flex-col gap-1.5"
          role="group"
          aria-label="Roles that get the guidance"
        >
          <div className="flex flex-wrap gap-1.5">
            {GUIDANCE_ROLE_CHOICES.map((choice) => {
              const isOn = roles.includes(choice.role);
              return (
                <Chip
                  key={choice.role}
                  as="button"
                  tone={isOn ? 'primary' : 'neutral'}
                  size="sm"
                  ariaPressed={isOn}
                  icon={isOn ? <Check size={ICON_SIZE.row} aria-hidden /> : undefined}
                  label={choice.label}
                  onClick={() =>
                    onRoles(
                      isOn
                        ? roles.filter((role) => role !== choice.role)
                        : GUIDANCE_ROLE_CHOICES.map((entry) => entry.role).filter(
                            (role) => role === choice.role || roles.includes(role),
                          ),
                    )
                  }
                />
              );
            })}
          </div>
          <span className="text-secondary text-faint-foreground">
            {guidanceLeftOutText({ roles })}
          </span>
        </div>
      ) : null}
    </div>
  );
};
