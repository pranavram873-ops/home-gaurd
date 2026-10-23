'use client';

import type { NotificationItem } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { describeQueryError, describeThrownError, type ListResult, type ActionResult } from './queryError';
import { NOTIFICATION_SELECT } from './selects';

/**
 * The bell. "Users view own notifications" is the whole access rule: a user can
 * only ever read the rows addressed to them, which is why no id is required
 * beyond the caller's own.
 */
export async function listNotifications(
  userId: string,
  options: { limit?: number; unreadOnly?: boolean } = {},
): Promise<ListResult<NotificationItem>> {
  try {
    const supabase = createClient();
    let query = supabase
      .from('notifications')
      .select(NOTIFICATION_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(options.limit ?? 20);

    if (options.unreadOnly) query = query.eq('is_read', false);

    const { data, error } = await query;
    if (error) return { data: [], error: describeQueryError(error) };
    return { data: (data ?? []) as NotificationItem[], error: null };
  } catch (err) {
    return { data: [], error: describeThrownError(err, 'Could not load notifications.') };
  }
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) return { ok: false, error: describeQueryError(error) };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: describeThrownError(err, 'The notification could not be marked read.') };
  }
}

export interface NotificationPush {
  title: string;
  message: string;
  type?: NotificationItem['type'];
  link?: string | null;
}

/**
 * The insert policy is `WITH CHECK (true)`, so an administrator's browser may
 * address a notification to the applicant they just approved. Failures are
 * swallowed by callers: a missing bell item must never roll back a decision that
 * the database already recorded.
 */
export async function pushNotification(
  userId: string,
  notification: NotificationPush,
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title: notification.title,
      message: notification.message,
      type: notification.type ?? 'general',
      is_read: false,
      link: notification.link ?? null,
    });

    if (error) return { ok: false, error: describeQueryError(error) };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: describeThrownError(err, 'The notification could not be sent.') };
  }
}
