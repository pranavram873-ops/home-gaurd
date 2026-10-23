'use client';

import type { AuditLog } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { describeQueryError, describeThrownError, type ListResult, type ActionResult } from './queryError';
import { AUDIT_SELECT } from './selects';

export interface AuditEntry {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown>;
  /** Resolved from the browser session when the caller does not already know it. */
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
}

/**
 * Append-only trail. The insert policy is `actor_id = auth.uid() OR actor_id IS
 * NULL`, so a client may only sign an entry with its own identity; there is no
 * update or delete policy at all, which is the point of an audit log.
 *
 * Writing the trail must never break the action it describes, so callers are
 * expected to log the outcome and ignore a failure here rather than undo it.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<ActionResult> {
  try {
    const supabase = createClient();
    let actorId = entry.actorId ?? null;

    if (!actorId) {
      const { data } = await supabase.auth.getUser();
      actorId = data.user?.id ?? null;
    }

    const { error } = await supabase.from('audit_logs').insert({
      actor_id: actorId,
      actor_email: entry.actorEmail ?? null,
      actor_role: entry.actorRole ?? null,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      details: entry.details ?? {},
    });

    if (error) return { ok: false, error: describeQueryError(error) };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: describeThrownError(err, 'The audit entry could not be written.') };
  }
}

/**
 * Administrators only: "Admins can view audit logs" returns nothing for any other
 * role, so a guard calling this simply sees an empty list rather than an error.
 */
export async function listAuditLogs(limit = 50): Promise<ListResult<AuditLog>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('audit_logs')
      .select(AUDIT_SELECT)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return { data: [], error: describeQueryError(error) };
    return { data: (data ?? []) as unknown as AuditLog[], error: null };
  } catch (err) {
    return { data: [], error: describeThrownError(err, 'Could not load the audit trail.') };
  }
}
