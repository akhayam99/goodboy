export type WorkflowRoutingFlags = {
  readonly isModelMetadataEnabled: boolean;
};

const isEnabledValue = ({ value }: { readonly value: unknown }): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'string') {
    return false;
  }
  return value.trim().toLowerCase() === 'true';
};

export const workflowRoutingFlags = (): WorkflowRoutingFlags => ({
  isModelMetadataEnabled: isEnabledValue({
    value: import.meta.env.VITE_WORKFLOW_MODEL_METADATA,
  }),
});
