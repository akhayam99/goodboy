export const m081RoleCleanup = `
UPDATE steps SET role = 'planner' WHERE role IN ('architect', 'product');
UPDATE steps SET role = 'scout' WHERE role = 'explorer';
UPDATE step_library SET role = 'planner' WHERE role IN ('architect', 'product');
UPDATE step_library SET role = 'scout' WHERE role = 'explorer';
`;
