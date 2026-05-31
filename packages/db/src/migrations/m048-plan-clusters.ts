export const m048PlanClusters = /* sql */ `
ALTER TABLE session_plans ADD COLUMN clusters_json TEXT;
`;
