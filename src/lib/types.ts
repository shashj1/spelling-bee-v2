export interface Group {
  id: string;
  name: string;
  created_at: string;
}

export interface WordList {
  id: string;
  group_id: string;
  words: string[];
  sentences: Record<string, string> | null;  // word → funny sentence
  story: string | null;
  audio_urls: Record<string, string> | null; // key → public URL
  created_at: string;
  expires_at: string;
  generated: boolean;
}

export interface Practice {
  id: string;
  word_list_id: string;
  group_id: string;
  child_name: string;
  score: number | null;
  total: number | null;
  created_at: string;
}

export interface LeaderboardEntry {
  child_name: string;
  practice_count: number;
}

// Audio keys follow this pattern:
// "word_<word>"              → "The word is: <word>"
// "sentence_<word>"          → funny sentence audio
// "check_announce_<word>"    → "Word number N: <word>"
// "check_word_<word>"        → the word spoken after spelling
// "letter_<word>_<i>_<L>"   → individual letter
// "story"                    → the full silly story
export function audioKey(type: "word" | "sentence" | "check_announce" | "check_word" | "letter" | "story", word?: string): string {
  if (type === "story") return "story";
  return `${type}_${word!.toLowerCase().replace(/\s+/g, "_")}`;
}
