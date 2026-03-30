import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// POST /api/ocr — extract spelling words from a photo
// Body: FormData with "image" file
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("image") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  // Convert file to base64
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");

  // Determine media type
  const mediaType = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType)) {
    return NextResponse.json({ error: "Unsupported image format. Use JPEG, PNG, GIF, or WebP." }, { status: 400 });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `This is a photo of a primary school spelling list. Extract ONLY the spelling words from this image. Return them as a JSON array of strings, one word per entry. Do not include any numbering, definitions, or other text — just the words themselves in lowercase. Example: ["beautiful", "because", "believe"]. Return ONLY the JSON array, nothing else.`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // Parse the JSON array from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not extract words from image. Please try again or type them manually." }, { status: 422 });
    }

    const words: string[] = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ words });
  } catch (err: any) {
    console.error("OCR error:", err);
    return NextResponse.json({ error: "Failed to process image: " + err.message }, { status: 500 });
  }
}
