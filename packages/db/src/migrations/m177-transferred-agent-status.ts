export const m177TransferredAgentStatus = `
UPDATE agents SET status = 'transferred'
 WHERE status = 'failed'
   AND id IN (
     SELECT obligation.requester_agent_id
       FROM capability_grants grant_row
       JOIN capability_obligations obligation ON obligation.id = grant_row.obligation_id
      WHERE grant_row.parent_outcome = 'transferred'
   );
`;
