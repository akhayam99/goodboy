import {
  cloneElement,
  isValidElement,
  useId,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from 'react'
import { cn } from '../cn'
import { Input } from './Input'
import { Select } from './Select'
import { Textarea } from './Textarea'

// A child is "labelable" (worth a real <label htmlFor>/id association) only when
// it renders a native form control. Detect intrinsic input/select/textarea by
// tag string, or our form primitives that forward id onto such an element.
// Everything else (Button, ToggleSwitch, div/span/ul, custom components) gets an
// inert <span> so clicking the descriptive label text can't activate a button.
const LABELABLE_TAGS = new Set(['input', 'select', 'textarea'])
const LABELABLE_COMPONENTS = new Set<ElementType>([Input, Select, Textarea])

const isLabelableControl = (child: ReactNode): child is ReactElement<{ id?: string }> => {
  if (!isValidElement(child)) {
    return false
  }
  const { type } = child
  if (typeof type === 'string') {
    return LABELABLE_TAGS.has(type)
  }
  return LABELABLE_COMPONENTS.has(type as ElementType)
}

export type FieldRowProps = {
  readonly label: string
  readonly help?: ReactNode
  readonly children: ReactNode
  readonly layout?: 'horizontal' | 'stacked'
  readonly className?: string
}

export const FieldRow = ({
  label,
  help,
  children,
  layout = 'horizontal',
  className,
}: FieldRowProps) => {
  const controlId = useId()
  const labelable = isLabelableControl(children)
  const associate = labelable && children.props.id === undefined

  const labelBlock = (
    <div className="flex min-w-0 flex-col gap-0.5">
      {associate ? (
        <label htmlFor={controlId} className="text-xs font-medium text-foreground">
          {label}
        </label>
      ) : (
        <span className="text-xs font-medium text-foreground">{label}</span>
      )}
      {help ? <p className="text-2xs leading-relaxed text-muted-foreground">{help}</p> : null}
    </div>
  )

  const control = associate ? cloneElement(children, { id: controlId }) : children

  if (layout === 'stacked') {
    return (
      <div className={cn('flex flex-col gap-2 py-4 first:pt-0 last:pb-0', className)}>
        {labelBlock}
        <div>{control}</div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6',
        className,
      )}
    >
      {labelBlock}
      <div className="shrink-0">{control}</div>
    </div>
  )
}
