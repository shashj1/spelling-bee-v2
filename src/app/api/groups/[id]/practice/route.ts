import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { LeaderboardEntry } from "@/lib/types";

// GET /api/groups/[id]/practice — get leaderboard for current word list
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Get current word list
  const { data: wordList } = await supabase
    .from("word_lists")
    .select("id")
    .eq("group_id", params.id)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!wordList) {
    return NextResponse.json({ leaderboard: [] });
  }

  // Get all practices for this word list
  const { data: practices, error } = await supabase
    .from("practices")
    .select("child_name")
    .eq("word_list_id", wordList.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Count practices per child
  const counts: Record<string, number> = {};
  for (const p of practices || []) {
    const name = p.child_name.toLowerCase().trim();
    counts[name] = (counts[name] || 0) + 1;
  }

  // Build leaderboard sorted by practice count (descending)
  const leaderboard: LeaderboardEntry[] = Object.entries(counts)
    .map(([child_name, practice_count]) => ({ child_name, practice_count }))
    .sort((a, b) => b.practice_count - a.practice_count);

  return NextResponse.json({ leaderboard });
}

// POST /api/groups/[id]/practice — log a practice session
// Body: { child_name: string, score?: number, total?: number }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { child_name, score, total } = await req.json();

  if (!child_name || typeof child_name !== "string" || child_name.trim().length === 0) {
    return NextResponse.json({ error: "Child name is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Get current word list
  const { data: wordList } = await supabase
    .from("word_lists")
    .select("id")
    .eq("group_id", params.id)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!wordList) {
    return NextResponse.json({ error: "No active word list" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("practices")
    .insert({
      word_list_id: wordList.id,
      group_id: params.id,
      child_name: child_name.trim(),
      score: score ?? null,
      total: total ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ practice: data }, { status: 201 });
}
