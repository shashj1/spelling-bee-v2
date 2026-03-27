import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseAdmin } from "@/lib/supabase";

// POST /api/tts — generate speech audio for given text
// Body: { text: string, key: string, word_list_id: string }
// Returns: { url: string } — public URL or data URI of the audio
export async function POST(req: NextRequest) {
  const { text, key, word_list_id } = await req.json();

  if (!text || !key || !word_list_id) {
    return NextResponse.json(
      { error: "text, key, and word_list_id are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Check if we already have this audio cached
  const { data: wordList } = await supabase
    .from("word_lists")
    .select("audio_urls")
    .eq("id", word_list_id)
    .single();

  if (wordList?.audio_urls?.[key]) {
    return NextResponse.json({ url: wordList.audio_urls[key] });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "fable", // British-sounding voice
      input: text,
      response_format: "mp3",
    });

    // Get audio bytes
    const audioBuffer = Buffer.from(await response.arrayBuffer());

    // Try to upload to Supabase Storage for caching
    let url: string;
    const filePath = `${word_list_id}/${key}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from("audio")
      .upload(filePath, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error (using data URI fallback):", uploadError);
      // Fallback: return as base64 data URI — still works, just not cached
      const base64 = audioBuffer.toString("base64");
      url = `data:audio/mpeg;base64,${base64}`;
    } else {
      // Get public URL
      const { data: urlData } = supabase.storage
        .from("audio")
        .getPublicUrl(filePath);
      url = urlData.publicUrl;

      // Cache the URL in the word list record
      const existingUrls = wordList?.audio_urls || {};
      await supabase
        .from("word_lists")
        .update({ audio_urls: { ...existingUrls, [key]: url } })
        .eq("id", word_list_id);
    }

    return NextResponse.json({ url });
  } catch (err: any) {
    console.error("TTS error:", err);
    return NextResponse.json(
      { error: "Failed to generate speech: " + err.message },
      { status: 500 }
    );
  }
}
