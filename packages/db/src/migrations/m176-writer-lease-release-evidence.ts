export const m176WriterLeaseReleaseEvidence = `
ALTER TABLE writer_leases ADD COLUMN released_by TEXT;
ALTER TABLE writer_leases ADD COLUMN release_evidence TEXT;
`;
