import {
  cloneElement,
  isValidElement,
  useContext,
  useId,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '../cn';
import { BandDepthContext } from './Band/bandDepth';
import { Checkbox } from './Checkbox';
import { Input } from './Input';
import { Listbox } from './Listbox';
import { Textarea } from './Textarea';

const LABELABLE_TAGS = new Set(['input', 'textarea']);
const LABELABLE_COMPONENTS = new Set<ElementType>([Input, Listbox, Textarea, Checkbox]);

const isLabelableControl = (child: ReactNode): child is ReactElement<{ id?: string }> => {
  if (!isValidElement(child)) {
    return false;
  }
  const { type } = child;
  if (typeof type === 'string') {
    return LABELABLE_TAGS.has(type);
  }
  return LABELABLE_COMPONENTS.has(type as ElementType);
};

export type FieldRowProps = {
  readonly label: string;
  readonly help?: ReactNode;
  readonly marker?: ReactNode;
  readonly menu?: ReactNode;
  readonly children: ReactNode;
  readonly layout?: 'horizontal' | 'stacked';
  readonly className?: string;
};

export const FieldRow = ({
  label,
  help,
  marker,
  menu,
  children,
  layout = 'horizontal',
  className,
}: FieldRowProps) => {
  const controlId = useId();
  const isInsideBand = useContext(BandDepthContext);
  const rhythm = isInsideBand ? 'py-2 first:pt-0 last:pb-0' : 'py-4 first:pt-0 last:pb-0';
  const labelable = isLabelableControl(children);
  const associate = labelable && children.props.id === undefined;

  const labelText = associate ? (
    <label htmlFor={controlId} className="text-label font-medium text-foreground">
      {label}
    </label>
  ) : (
    <span className="text-label font-medium text-foreground">{label}</span>
  );

  const labelBlock = (
    <div className="flex min-w-40 shrink flex-col gap-0.5">
      {marker == null ? (
        labelText
      ) : (
        <span className="flex min-w-0 items-center gap-1.5">
          {labelText}
          {marker}
        </span>
      )}
      {help ? <p className="text-2xs leading-relaxed text-muted-foreground">{help}</p> : null}
    </div>
  );

  const associated = associate ? cloneElement(children, { id: controlId }) : children;
  const control =
    menu == null ? (
      associated
    ) : (
      <span className="flex items-center gap-1">
        {associated}
        {menu}
      </span>
    );

  if (layout === 'stacked') {
    return (
      <div className={cn('flex flex-col gap-2', rhythm, className)}>
        {menu == null ? (
          labelBlock
        ) : (
          <div className="flex items-start justify-between gap-6">
            {labelBlock}
            {menu}
          </div>
        )}
        <div className={menu == null ? undefined : 'pr-7'}>{associated}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6',
        rhythm,
        className,
      )}
    >
      {labelBlock}
      <div className="shrink-0">{control}</div>
    </div>
  );
};
