export const m155WorkflowRoutingDecisions = `
ALTER TABLE steps ADD COLUMN routing_lock TEXT DEFAULT NULL CHECK (routing_lock IS NULL OR json_valid(routing_lock));
ALTER TABLE steps ADD COLUMN routing_decision TEXT DEFAULT NULL CHECK (routing_decision IS NULL OR json_valid(routing_decision));
ALTER TABLE steps ADD COLUMN task_profile TEXT DEFAULT NULL CHECK (task_profile IS NULL OR json_valid(task_profile));
ALTER TABLE agents ADD COLUMN routing_lock TEXT DEFAULT NULL CHECK (routing_lock IS NULL OR json_valid(routing_lock));
ALTER TABLE agents ADD COLUMN routing_decision TEXT DEFAULT NULL CHECK (routing_decision IS NULL OR json_valid(routing_decision));
ALTER TABLE agents ADD COLUMN task_profile TEXT DEFAULT NULL CHECK (task_profile IS NULL OR json_valid(task_profile));
`;
