import { Suspense } from 'react';
import type { ComponentProps } from 'react';
import { lazyNamed } from '../../lib/lazyNamed';

const Form = lazyNamed({
  load: () => import('./index'),
  pick: ({ NewWorkspaceForm }) => NewWorkspaceForm,
});

type Props = ComponentProps<typeof Form>;

export const LazyNewWorkspaceForm = ({
  mode,
  workspaceId,
  start,
  titleRole,
  hasTitle,
  onCreated,
  onCancel,
  backLabel,
  error,
}: Props) => (
  <Suspense
    fallback={
      <p role="status" className="px-4 py-3 text-meta text-muted-foreground">
        Opening the form
      </p>
    }
  >
    <Form
      mode={mode}
      workspaceId={workspaceId}
      start={start}
      titleRole={titleRole}
      hasTitle={hasTitle}
      onCreated={onCreated}
      onCancel={onCancel}
      backLabel={backLabel}
      error={error}
    />
  </Suspense>
);
