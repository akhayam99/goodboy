import { Tooltip, ICON_SIZE, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { PermissionMark } from '../../../auto/tree/markersOf';
import { permissionMarkLabelOf } from './permissionMarkLabelOf';

type Props = {
  readonly marks: ReadonlyArray<PermissionMark>;
};

export const LeadTreePermissionMarks = ({ marks }: Props) => (
  <>
    {marks.map((mark) => {
      const Icon =
        mark.decision === 'allow'
          ? CONCEPT_ICONS.permissionAllowed
          : CONCEPT_ICONS.permissionDenied;
      const label = permissionMarkLabelOf({ mark });
      return (
        <Tooltip key={mark.decision} content={label} anchorClassName="shrink-0">
          <span
            role="img"
            aria-label={label}
            data-lead-tree-permission={mark.decision}
            className={`flex shrink-0 items-center gap-0.5 text-meta tabular-nums ${
              tintClasses(mark.decision === 'allow' ? 'success' : 'danger').text
            }`}
          >
            <Icon size={ICON_SIZE.row} aria-hidden="true" />
            {mark.count > 1 ? mark.count : null}
          </span>
        </Tooltip>
      );
    })}
  </>
);
