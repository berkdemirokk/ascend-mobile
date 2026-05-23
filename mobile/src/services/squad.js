// Squad service — small private accountability rings (2–5 monks).
//
// The audit's biggest retention-lift recommendation, surgically scoped:
//   - NO public leaderboard (kills the Monk Mode brand)
//   - NO friend list / messaging (out of scope for v1)
//   - YES tiny private group with a shared 'collective streak'
//
// A squad day counts only when EVERY active member finished >=1 lesson
// that day. One member missing breaks the chain. That's the entire
// social mechanic — light commitment, zero shaming language, big
// loss-aversion pull.
//
// Server schema: see supabase/schema.sql, three tables (squads,
// squad_members, squad_member_progress).

import { supabase, SUPABASE_CONFIGURED } from './supabase';

const T_SQUADS = 'squads';
const T_MEMBERS = 'squad_members';
const T_PROGRESS = 'squad_member_progress';

const MAX_SQUAD_SIZE = 5;

/**
 * 6-char invite code: 'SQD-' + 3 alphanumeric letters. Generated
 * client-side; on collision the server insert returns an error and
 * the caller retries. 36^3 = ~47K codes; collision probability at
 * 1000 active squads is ~2% per attempt — retry once is enough.
 */
const generateSquadCode = () => {
  const chars = 'ABCDEFGHIJKMNPQRSTUVWXYZ23456789'; // skip O0LI1 for legibility
  let s = '';
  for (let i = 0; i < 4; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return `SQD-${s}`;
};

/**
 * Create a new squad. Returns the squad row on success or
 * { error: string } on failure.
 */
export const createSquad = async ({ name, ownerUserId, anonDisplayName }) => {
  if (!SUPABASE_CONFIGURED) return { error: 'offline' };
  if (!ownerUserId) return { error: 'auth_required' };
  const trimmedName = String(name || '').trim().slice(0, 40);
  if (trimmedName.length < 2) return { error: 'name_too_short' };

  // Try up to 3 codes if collisions hit.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateSquadCode();
    try {
      const { data: squad, error } = await supabase
        .from(T_SQUADS)
        .insert({ name: trimmedName, code, owner_user_id: ownerUserId })
        .select()
        .single();
      if (error) {
        // Unique violation on code → retry with a new code.
        if (
          error.code === '23505' ||
          /unique/i.test(error.message || '')
        ) {
          continue;
        }
        return { error: error.message || 'server' };
      }
      // Auto-add the creator as the first member.
      const { error: memberErr } = await supabase
        .from(T_MEMBERS)
        .insert({
          squad_id: squad.id,
          user_id: ownerUserId,
          anon_display_name: anonDisplayName || 'monk',
        });
      if (memberErr) {
        // Best-effort cleanup: drop the half-created squad.
        await supabase.from(T_SQUADS).delete().eq('id', squad.id);
        return { error: memberErr.message || 'member_insert_failed' };
      }
      return { squad };
    } catch (e) {
      return { error: e?.message || 'exception' };
    }
  }
  return { error: 'code_collision' };
};

/**
 * Join an existing squad by code. Returns the squad row on success.
 */
export const joinSquadByCode = async ({
  code,
  userId,
  anonDisplayName,
}) => {
  if (!SUPABASE_CONFIGURED) return { error: 'offline' };
  if (!userId) return { error: 'auth_required' };
  const cleanCode = String(code || '').trim().toUpperCase();
  if (!cleanCode || cleanCode.length < 4) {
    return { error: 'invalid' };
  }

  try {
    const { data: squad, error: findErr } = await supabase
      .from(T_SQUADS)
      .select('*')
      .eq('code', cleanCode)
      .maybeSingle();
    if (findErr) return { error: findErr.message || 'server' };
    if (!squad) return { error: 'not_found' };

    // Size cap.
    const { count: memberCount } = await supabase
      .from(T_MEMBERS)
      .select('*', { count: 'exact', head: true })
      .eq('squad_id', squad.id);
    if ((memberCount || 0) >= MAX_SQUAD_SIZE) {
      return { error: 'full' };
    }

    const { error: insertErr } = await supabase.from(T_MEMBERS).insert({
      squad_id: squad.id,
      user_id: userId,
      anon_display_name: anonDisplayName || 'monk',
    });
    if (insertErr) {
      // Unique violation = already member.
      if (
        insertErr.code === '23505' ||
        /unique/i.test(insertErr.message || '')
      ) {
        return { squad, alreadyMember: true };
      }
      return { error: insertErr.message || 'server' };
    }
    return { squad };
  } catch (e) {
    return { error: e?.message || 'exception' };
  }
};

/**
 * Get the user's current squad (just one for v1 — we'll loosen later
 * if there's demand for multi-squad). Returns { squad, members,
 * progressByDate } or null if not in any squad.
 */
export const getMySquad = async (userId) => {
  if (!SUPABASE_CONFIGURED || !userId) return null;
  try {
    // First squad I'm a member of (ordered by joined_at — keeps the
    // 'most recently joined' on top in the unlikely multi-membership
    // future).
    const { data: myMembership } = await supabase
      .from(T_MEMBERS)
      .select('squad_id, joined_at')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!myMembership) return null;
    const squadId = myMembership.squad_id;

    const { data: squad } = await supabase
      .from(T_SQUADS)
      .select('*')
      .eq('id', squadId)
      .maybeSingle();
    if (!squad) return null;

    const { data: members } = await supabase
      .from(T_MEMBERS)
      .select('user_id, anon_display_name, joined_at')
      .eq('squad_id', squadId)
      .order('joined_at', { ascending: true });

    // Last 14 days of progress (enough to render a recent-chain widget).
    const sinceDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 14);
      return d.toISOString().slice(0, 10);
    })();
    const { data: progressRows } = await supabase
      .from(T_PROGRESS)
      .select('user_id, date, lessons_count')
      .eq('squad_id', squadId)
      .gte('date', sinceDate);

    // Index progress by date: { '2026-05-22': { userId: count, ... } }
    const progressByDate = {};
    for (const r of progressRows || []) {
      if (!progressByDate[r.date]) progressByDate[r.date] = {};
      progressByDate[r.date][r.user_id] = r.lessons_count;
    }

    return { squad, members: members || [], progressByDate };
  } catch (e) {
    console.warn('[squad] getMySquad exception:', e?.message);
    return null;
  }
};

/**
 * Record a lesson completion for the squad. Called every time the
 * user finishes a lesson — idempotent for the same (squad, user,
 * date) tuple via upsert with conflict on the unique constraint.
 */
export const recordSquadProgress = async ({
  squadId,
  userId,
  date,
  lessonsCount = 1,
}) => {
  if (!SUPABASE_CONFIGURED || !squadId || !userId || !date) return false;
  try {
    const { error } = await supabase.from(T_PROGRESS).upsert(
      {
        squad_id: squadId,
        user_id: userId,
        date,
        lessons_count: lessonsCount,
      },
      { onConflict: 'squad_id,user_id,date' },
    );
    if (error) {
      console.warn('[squad] recordSquadProgress error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[squad] recordSquadProgress exception:', e?.message);
    return false;
  }
};

/**
 * Leave the current squad. Cascades the user's progress rows for
 * that squad (FK on delete cascade).
 */
export const leaveSquad = async ({ squadId, userId }) => {
  if (!SUPABASE_CONFIGURED || !squadId || !userId) return false;
  try {
    const { error } = await supabase
      .from(T_MEMBERS)
      .delete()
      .eq('squad_id', squadId)
      .eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
};

/**
 * Compute the collective streak — how many CONSECUTIVE days, ending
 * today, where EVERY active member finished >=1 lesson. Pure client
 * math from the progressByDate map.
 */
export const computeCollectiveStreak = (members, progressByDate) => {
  if (!members?.length || !progressByDate) return 0;
  const memberIds = new Set(members.map((m) => m.user_id));
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayProgress = progressByDate[dateStr] || {};
    // Every member must have a progress row >=1 to count.
    let allDone = true;
    for (const memberId of memberIds) {
      if (!dayProgress[memberId] || dayProgress[memberId] < 1) {
        allDone = false;
        break;
      }
    }
    if (allDone) {
      streak += 1;
    } else if (i === 0) {
      // Today not yet done — that's fine, streak stays at zero so
      // far but doesn't BREAK (the day isn't over). Keep counting
      // from yesterday.
      continue;
    } else {
      break;
    }
  }
  return streak;
};
