import { useId, useState } from 'react';
import { FieldError, fieldErrorAriaOf, Input, PageColumn } from '@goodboy/ui';

type CheckParams = {
  readonly template: string;
};

const errorOf = ({ template }: CheckParams): string | null =>
  template.split('{').length === template.split('}').length
    ? null
    : 'A brace has no closing brace. Close {task} to save the template.';

export const FieldErrorScene = () => {
  const [template, setTemplate] = useState('hl/{task');
  const errorId = useId();
  const error = errorOf({ template });

  return (
    <main className="flex min-h-screen bg-background py-8 text-foreground">
      <PageColumn width="measure" className="flex flex-col gap-2">
        <label htmlFor="branch-template" className="text-row text-foreground">
          Branch template for Harborline
        </label>
        <Input
          id="branch-template"
          size="md"
          value={template}
          onChange={(event) => setTemplate(event.target.value)}
          {...fieldErrorAriaOf({ id: errorId, error })}
        />
        <FieldError id={errorId} error={error} />
      </PageColumn>
    </main>
  );
};
