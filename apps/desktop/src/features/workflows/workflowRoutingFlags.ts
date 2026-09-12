export type WorkflowRoutingFlags = {
  readonly isModelMetadataEnabled: boolean;
  readonly isChildModelSelectionEnabled: boolean;
};

const isDisabledValue = ({ value }: { readonly value: unknown }): boolean => {
  if (typeof value === 'boolean') {
    return value === false;
  }
  if (typeof value !== 'string') {
    return false;
  }
  return value.trim().toLowerCase() === 'false';
};

export const workflowRoutingFlags = (): WorkflowRoutingFlags => ({
  isModelMetadataEnabled: !isDisabledValue({
    value: import.meta.env.VITE_WORKFLOW_MODEL_METADATA,
  }),
  isChildModelSelectionEnabled: !isDisabledValue({
    value: import.meta.env.VITE_WORKFLOW_CHILD_MODEL_SELECTION,
  }),
});
