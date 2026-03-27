import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getNextThursdayNoon, isExpired } from "@/lib/utils";
import { WordList } from "@/lib/types";

// GET /api/groups/[id]/words — get current active word list for a group
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("word_lists")
    .select("*")
    .eq("group_id", params.id)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wordList: data });
}

// POST /api/groups/[id]/words — upload a new word list
// Body: { words: string[], password?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { words, password } = await req.json();

  if (!Array.isArray(words) || words.length === 0) {
    return NextResponse.json({ error: "Words array is required" }, { status: 400 });
  }

  // Clean and validate words
  const cleanWords = words
    .map((w: unknown) => (typeof w === "string" ? w.trim().toLowerCase() : ""))
    .filter((w: string) => w.length > 0);

  if (cleanWords.length === 0) {
    return NextResponse.json({ error: "No valid words provided" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Check if there's already an active word list for this group
  const { data: existing } = await supabase
    .from("word_lists")
    .select("id")
    .eq("group_id", params.id)
    .gt("expires_at", now)
    .limit(1)
    .maybeSingle();

  // If a list already exists, require admin password to override
  if (existing) {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!password || password !== adminPassword) {
      return NextResponse.json(
        { error: "A word list already exists this week. Admin password required to override." },
        { status: 403 }
      );
    }

    // Delete old list (cascading deletes practices too, which is fine for a correction)
    await supabase.from("word_lists").delete().eq("id", existing.id);
  }

  // Calculate expiry: next Thursday at noon UK time
  const expiresAt = getNextThursdayNoon().toISOString();

  const { data, error } = await supabase
    .from("word_lists")
    .insert({
      group_id: params.id,
      words: cleanWords,
      expires_at: expiresAt,
      generated: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wordList: data }, { status: 201 });
}
