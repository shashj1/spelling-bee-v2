import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";

// POST /api/generate/[wordListId] — generate funny sentences and story for a word list
// This should be called once after uploading words. It generates all text content
// and then triggers TTS generation for all audio.
export async function POST(
  _req: NextRequest,
  { params }: { params: { wordListId: string } }
) {
  const supabase = getSupabaseAdmin();

  // Get the word list
  const { data: wordList, error } = await supabase
    .from("word_lists")
    .select("*")
    .eq("id", params.wordListId)
    .single();

  if (error || !wordList) {
    return NextResponse.json({ error: "Word list not found" }, { status: 404 });
  }

  if (wordList.generated) {
    return NextResponse.json({ message: "Already generated", wordList });
  }

  const words: string[] = wordList.words;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Generate funny sentences for each word
    const sentencesResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are writing for British primary school children aged 6-10. For each spelling word below, write ONE very funny, very silly sentence that uses the word. The sentences should make children laugh — think ridiculous situations, talking animals, absurd scenarios. Use British English throughout (no American spellings or idioms). Keep each sentence short (under 20 words).

Words: ${words.join(", ")}

Return ONLY a JSON object mapping each word to its sentence. Example:
{"beautiful": "The hamster wore a beautiful hat made entirely of spaghetti to the queen's garden party."}

Return ONLY the JSON, nothing else.`,
        },
      ],
    });

    const sentencesText =
      sentencesResponse.content[0].type === "text" ? sentencesResponse.content[0].text : "{}";
    const jsonMatch = sentencesText.match(/\{[\s\S]*\}/);
    const sentences: Record<string, string> = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // Generate a silly story using all words
    const storyResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are writing for British primary school children aged 6-10. Write a short, very funny, very silly story (about 100-150 words) that naturally includes ALL of these spelling words: ${words.join(", ")}

The story should:
- Be absolutely hilarious and absurd — make children laugh out loud
- Use British English throughout (no American spellings or idioms)
- Be suitable for children under 10
- Include every single word from the list at least once
- Have a clear beginning, middle, and end

Return ONLY the story text, nothing else.`,
        },
      ],
    });

    const story =
      storyResponse.content[0].type === "text" ? storyResponse.content[0].text.trim() : "";

    // Update the word list with generated content
    const { data: updated, error: updateError } = await supabase
      .from("word_lists")
      .update({
        sentences,
        story,
        generated: true,
      })
      .eq("id", params.wordListId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ wordList: updated });
  } catch (err: any) {
    console.error("Generate error:", err);
    return NextResponse.json({ error: "Failed to generate content: " + err.message }, { status: 500 });
  }
}
