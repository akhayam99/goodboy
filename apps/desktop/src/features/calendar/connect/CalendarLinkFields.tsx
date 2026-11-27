import { FieldError, Input, fieldErrorAriaOf } from '@goodboy/ui';
import { ConnectSection } from './ConnectSection';

type Props = {
  readonly url: string;
  readonly label: string;
  readonly error: string | null;
  readonly isDisabled: boolean;
  readonly onUrlChange: (url: string) => void;
  readonly onLabelChange: (label: string) => void;
};

const URL_ID = 'calendar-link-url';
const URL_ERROR_ID = 'calendar-link-url-error';
const LABEL_ID = 'calendar-link-label';

export const CalendarLinkFields = ({
  url,
  label,
  error,
  isDisabled,
  onUrlChange,
  onLabelChange,
}: Props) => (
  <ConnectSection label="Link">
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={URL_ID} className="text-row text-foreground">
        Calendar link
      </label>
      <Input
        id={URL_ID}
        size="md"
        type="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="https://calendar.northwind.example/ical/basic.ics"
        value={url}
        disabled={isDisabled}
        onChange={(event) => onUrlChange(event.target.value)}
        {...fieldErrorAriaOf({ id: URL_ERROR_ID, error })}
      />
      <FieldError id={URL_ERROR_ID} error={error} />
    </div>
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={LABEL_ID} className="text-row text-foreground">
        Name
      </label>
      <Input
        id={LABEL_ID}
        size="md"
        autoComplete="off"
        placeholder="Shown as the link's host when empty"
        value={label}
        disabled={isDisabled}
        onChange={(event) => onLabelChange(event.target.value)}
      />
    </div>
  </ConnectSection>
);
