import type { Knex } from 'knex';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  requestId?: string;
  /** Safe before/after summary only: never passwords, tokens or full PII. */
  summary?: Record<string, unknown>;
}

export async function recordAudit(db: Knex | Knex.Transaction, e: AuditEntry): Promise<void> {
  await db('audit_events').insert({
    actor_id: e.actorId ?? null,
    action: e.action,
    target_type: e.targetType ?? null,
    target_id: e.targetId ?? null,
    request_id: e.requestId ?? null,
    summary: e.summary ? JSON.stringify(e.summary) : null,
  });
}
