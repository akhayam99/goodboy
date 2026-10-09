import { AnchoredPopover, cn, ScrollFade, Tooltip, useDropdown } from '@goodboy/ui';
import { Plus } from 'lucide-react';
import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';
import type { FooterIntegrationEntry } from './categories';
import { FOOTER_LABEL, FOOTER_LABELED_PAD } from './FooterButton';
import { IntegrationAddRow } from './IntegrationAddRow';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/names';

type Props = {
  readonly members: ReadonlyArray<FooterIntegrationEntry>;
  readonly connected: Readonly<Record<IntegrationGlyphProvider, boolean>>;
  readonly onOpenIntegration: (params: { readonly provider: IntegrationGlyphProvider }) => void;
  readonly isEmpty: boolean;
  readonly active: boolean;
};

type SelectParams = { readonly provider: IntegrationGlyphProvider };

const PANEL_WIDTH = 240;
const PANEL_MAX_HEIGHT = 240;

export const IntegrationAddPopover = ({
  members,
  connected,
  onOpenIntegration,
  isEmpty,
  active,
}: Props) => {
  const dropdown = useDropdown({
    align: 'center',
    width: 'w-60',
    expectedWidth: PANEL_WIDTH,
    expectedHeight: PANEL_MAX_HEIGHT,
  });

  const select = ({ provider }: SelectParams) => {
    dropdown.close();
    onOpenIntegration({ provider });
  };

  const actionLabel = isEmpty ? 'Connect your first integration' : NAMES.connectIntegration;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Integrations"
      className="flex flex-col"
      anchorClassName="shrink-0"
      hasBackdrop
      trigger={
        <Tooltip content={actionLabel}>
          <button
            type="button"
            onClick={dropdown.toggle}
            aria-label={actionLabel}
            aria-expanded={dropdown.open}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center rounded-md py-1 text-chip transition-colors',
              isEmpty ? 'gap-2 px-2' : FOOTER_LABELED_PAD,
              active
                ? 'cursor-default bg-overlay-selected text-foreground'
                : dropdown.open
                  ? 'bg-hover text-foreground'
                  : 'text-muted-foreground hover:bg-hover hover:text-foreground',
            )}
          >
            <Plus size={ICON_SIZE.row} aria-hidden />
            <span className={cn(!isEmpty && FOOTER_LABEL)}>{NAMES.connectIntegration}</span>
          </button>
        </Tooltip>
      }
    >
      <ScrollFade className="max-h-60 min-h-0 flex-1" viewportClassName="py-1" fadeSize={12}>
        <ul aria-label="Integrations" className="flex flex-col">
          {members.map((member) => (
            <IntegrationAddRow
              key={member.provider}
              member={member}
              connected={connected[member.provider]}
              onSelect={() => select({ provider: member.provider })}
            />
          ))}
        </ul>
      </ScrollFade>
    </AnchoredPopover>
  );
};
