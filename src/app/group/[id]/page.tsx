"use client";

import { useEffect, useState, useRef } from "react";
import { WordList, LeaderboardEntry } from "@/lib/types";
import { audioKey } from "@/lib/types";
import { getScoreMessage } from "@/lib/utils";
import Link from "next/link";
import Bee, { MiniBee } from "@/components/Bee";

type View =
  | "loading"
  | "upload"
  | "generating"
  | "dashboard"
  | "practice-setup"
  | "practicing"
  | "transition-to-checking"
  | "checking"
  | "scoring"
  | "name-entry"
  | "leaderboard"
  | "story";

// Timer presets — friendlier than a fiddly slider
const TIMER_PRESETS = [
  { label: "10s", value: 10, desc: "Quick!" },
  { label: "15s", value: 15, desc: "Normal" },
  { label: "20s", value: 20, desc: "Steady" },
  { label: "30s", value: 30, desc: "Relaxed" },
  { label: "45s", value: 45, desc: "Plenty" },
  { label: "60s", value: 60, desc: "Ages!" },
];

export default function GroupPage({ params }: { params: { id: string } }) {
  const groupId = params.id;

  // Core state
  const [view, setView] = useState<View>("loading");
  const [wordList, setWordList] = useState<WordList | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState("");
  const [groupName, setGroupName] = useState("");

  // Upload state
  const [manualWords, setManualWords] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState("");
  const [ocrProcessing, setOcrProcessing] = useState(false);

  // Practice state
  const [seconds, setSeconds] = useState(15);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [practicePhase, setPracticePhase] = useState<
    "reading" | "sentence" | "writing" | "next"
  >("reading");
  const [currentSentence, setCurrentSentence] = useState("");

  // Checking state (phase 2)
  const [checkingIndex, setCheckingIndex] = useState(0);
  const [highlightedLetters, setHighlightedLetters] = useState(0);

  const [countdown, setCountdown] = useState(0);
  const [paused, setPaused] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pausedRef = useRef(false);
  const cancelRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const skipRef = useRef(false);

  // Results state
  const [score, setScore] = useState<number>(0);
  const [childName, setChildName] = useState("");
  const [submittingScore, setSubmittingScore] = useState(false);
  const [scoreMessage, setScoreMessage] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  // Load saved child name from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`spelling-bee-name-${groupId}`);
    if (saved) setChildName(saved);

    const savedTime = localStorage.getItem("spelling-bee-timer");
    if (savedTime) setSeconds(parseInt(savedTime));
  }, [groupId]);

  // Load group and word list
  useEffect(() => {
    loadGroup();
    loadWordList();
    loadLeaderboard();
  }, [groupId]);

  async function loadGroup() {
    try {
      const res = await fetch("/api/groups");
      const groups = await res.json();
      const group = groups.find((g: any) => g.id === groupId);
      if (group) setGroupName(group.name);
    } catch {}
  }

  async function loadWordList() {
    try {
      const res = await fetch(`/api/groups/${groupId}/words`);
      const data = await res.json();
      if (data.wordList) {
        setWordList(data.wordList);

        // If sentences are missing, auto-generate them
        if (!data.wordList.generated || !data.wordList.sentences) {
          setView("generating");
          try {
            const genRes = await fetch(`/api/generate/${data.wordList.id}`, {
              method: "POST",
            });
            const genData = await genRes.json();
            if (genRes.ok) {
              setWordList(genData.wordList);
            }
          } catch {
            // Continue without sentences — practice still works
          }
        }

        setView("dashboard");
      } else {
        setView("upload");
      }
    } catch {
      setError("Failed to load word list");
      setView("upload");
    }
  }

  async function loadLeaderboard() {
    try {
      const res = await fetch(`/api/groups/${groupId}/practice`);
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
    } catch {}
  }

  // === UPLOAD ===
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrProcessing(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setManualWords(data.words.join("\n"));
    } catch {
      setError("Failed to read photo. Please try again or type the words manually.");
    } finally {
      setOcrProcessing(false);
    }
  }

  async function submitWords(overridePassword?: string) {
    const words = manualWords
      .split(/[\n,]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0);

    if (words.length === 0) {
      setError("Please enter at least one word");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const body: any = { words };
      if (overridePassword) body.password = overridePassword;

      const res = await fetch(`/api/groups/${groupId}/words`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.status === 403) {
        setShowPasswordPrompt(true);
        setUploading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error);
        setUploading(false);
        return;
      }

      setWordList(data.wordList);
      setView("generating");

      // Generate sentences and story
      const genRes = await fetch(`/api/generate/${data.wordList.id}`, {
        method: "POST",
      });
      const genData = await genRes.json();

      if (genRes.ok) {
        setWordList(genData.wordList);
      } else {
        console.error("Generate failed:", genData);
        setError("Words saved but sentence generation failed. Practice will still work.");
      }

      setView("dashboard");
    } catch {
      setError("Failed to upload words");
    } finally {
      setUploading(false);
    }
  }

  function handlePasswordSubmit() {
    setShowPasswordPrompt(false);
    submitWords(password);
  }

  // === iOS AUDIO UNLOCK ===
  // iOS Safari requires a user gesture to unlock audio playback.
  // We play a tiny silent clip on the first tap to unlock the audio context.
  function unlockAudio() {
    const audio = new Audio(
      "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+1DEAAAGAAGn9AAAIgAANP8AAABMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//tQxBUAAADSAAAAAAAAANIAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ=="
    );
    audio.volume = 0.01;
    audio.play().catch(() => {});
  }

  // === TTS PLAYBACK ===
  async function playAudio(text: string, key: string): Promise<void> {
    if (!wordList) return;

    // Wait while paused
    while (pausedRef.current && !cancelRef.current) {
      await new Promise((r) => setTimeout(r, 200));
    }
    if (cancelRef.current) return;

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, key, word_list_id: wordList.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        console.error("TTS error:", data.error);
        return fallbackSpeak(text);
      }

      return new Promise<void>((resolve) => {
        const audio = new Audio(data.url);
        audioRef.current = audio;

        audio.onended = () => {
          audioRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          audioRef.current = null;
          fallbackSpeak(text).then(resolve);
        };
        audio.play().catch(() => {
          audioRef.current = null;
          fallbackSpeak(text).then(resolve);
        });
      });
    } catch {
      return fallbackSpeak(text);
    }
  }

  // Browser Speech Synthesis fallback if TTS API fails
  function fallbackSpeak(text: string): Promise<void> {
    return new Promise<void>((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        resolve();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-GB";
      utterance.rate = 0.9;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }

  // === PRACTICE FLOW ===

  function cancellableWait(ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      let elapsed = 0;
      const id = setInterval(() => {
        if (cancelRef.current) {
          clearInterval(id);
          resolve(false);
          return;
        }
        if (skipRef.current) {
          skipRef.current = false;
          clearInterval(id);
          resolve(true);
          return;
        }
        if (!pausedRef.current) {
          elapsed += 100;
        }
        if (elapsed >= ms) {
          clearInterval(id);
          resolve(true);
        }
      }, 100);
    });
  }

  function togglePause() {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);

    if (audioRef.current) {
      if (next) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
    }
  }

  function stopPractice() {
    cancelRef.current = true;
    pausedRef.current = false;
    skipRef.current = false;
    setPaused(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
  }

  function skipToNext() {
    // Skip remaining countdown / wait
    skipRef.current = true;
    // If in the writing timer, also clear the interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setCountdown(0);
    }
  }

  function goBackOneWord() {
    if (view === "practicing") {
      const prevIndex = Math.max(0, currentWordIndex - 1);
      stopPractice();
      setTimeout(() => {
        cancelRef.current = false;
        setCurrentWordIndex(prevIndex);
        setPracticePhase("reading");
        practiceWord(prevIndex);
      }, 100);
    } else if (view === "checking") {
      const prevIndex = Math.max(0, checkingIndex - 1);
      stopPractice();
      setTimeout(() => {
        cancelRef.current = false;
        setCheckingIndex(prevIndex);
        setHighlightedLetters(0);
        checkWord(prevIndex);
      }, 100);
    }
  }

  function repeatCurrentWord() {
    stopPractice();
    setTimeout(() => {
      cancelRef.current = false;
      if (view === "practicing") {
        setPracticePhase("reading");
        practiceWord(currentWordIndex);
      } else if (view === "checking") {
        setHighlightedLetters(0);
        checkWord(checkingIndex);
      }
    }, 100);
  }

  async function startPractice() {
    // Unlock audio on iOS
    unlockAudio();

    // Save timer preference
    localStorage.setItem("spelling-bee-timer", String(seconds));

    cancelRef.current = false;
    pausedRef.current = false;
    skipRef.current = false;
    setPaused(false);
    setCurrentWordIndex(0);
    setCurrentSentence("");
    setView("practicing");
    setPracticePhase("reading");
    await practiceWord(0);
  }

  // Phase 1: Read each word, read sentence aloud, wait for child to write
  async function practiceWord(index: number) {
    if (!wordList) return;
    const words = wordList.words;

    if (index >= words.length) {
      // Phase 1 done — show transition screen before checking
      setView("transition-to-checking");
      const ok = await cancellableWait(3500);
      if (!ok) return;

      setView("checking");
      setCheckingIndex(0);
      setHighlightedLetters(0);
      await checkWord(0);
      return;
    }

    const word = words[index];
    setCurrentWordIndex(index);
    setCurrentSentence("");

    // 1. Announce the word
    setPracticePhase("reading");
    await playAudio(
      `Number ${index + 1}. The word is: ${word}. ... ${word}.`,
      audioKey("word", word)
    );
    if (cancelRef.current) return;

    // Let the word sink in
    let ok = await cancellableWait(1500);
    if (!ok) return;

    // 2. Read the silly sentence — show it and read it aloud
    const sentence = wordList.sentences?.[word] || `Can you spell ${word}?`;
    setCurrentSentence(sentence);
    setPracticePhase("sentence");

    // Brief moment for the text to appear before audio starts
    ok = await cancellableWait(400);
    if (!ok) return;

    await playAudio(sentence, audioKey("sentence", word));
    if (cancelRef.current) return;

    // Pause after sentence so the child absorbs it
    ok = await cancellableWait(1200);
    if (!ok) return;

    // 3. Writing time — sentence stays visible
    setPracticePhase("writing");
    skipRef.current = false;
    await new Promise<void>((resolve) => {
      let remaining = seconds;
      setCountdown(remaining);
      timerRef.current = setInterval(() => {
        if (cancelRef.current || skipRef.current) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          skipRef.current = false;
          resolve();
          return;
        }
        if (!pausedRef.current) {
          remaining--;
          setCountdown(remaining);
          if (remaining <= 0) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            resolve();
          }
        }
      }, 1000);
    });
    if (cancelRef.current) return;

    // Brief transition
    setPracticePhase("next");
    ok = await cancellableWait(800);
    if (!ok) return;

    await practiceWord(index + 1);
  }

  // Phase 2: Check all words by spelling them out slowly, letter by letter
  async function checkWord(index: number) {
    if (!wordList) return;
    const words = wordList.words;

    if (index >= words.length) {
      setView("scoring");
      return;
    }

    const word = words[index];
    setCheckingIndex(index);
    setHighlightedLetters(0);

    // Announce: "Word number 1: beautiful"
    await playAudio(
      `Word number ${index + 1}: ${word}.`,
      audioKey("check_announce", word)
    );
    if (cancelRef.current) return;

    // Pause before spelling begins
    let ok = await cancellableWait(1200);
    if (!ok) return;

    // Spell out letter by letter with generous pauses
    const letters = word.split("");
    for (let i = 0; i < letters.length; i++) {
      if (cancelRef.current) return;

      // Wait while paused
      while (pausedRef.current && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, 200));
      }
      if (cancelRef.current) return;

      setHighlightedLetters(i + 1);

      // Read the letter aloud — cached by letter, not position!
      const letterName = letters[i].toUpperCase();
      await playAudio(letterName, audioKey("letter", letterName));
      if (cancelRef.current) return;

      // Generous pause between letters (2.5s) so the child can check
      ok = await cancellableWait(2500);
      if (!ok) return;
    }

    // Say the whole word again
    await playAudio(word, audioKey("check_word", word));
    if (cancelRef.current) return;

    // Pause before next word
    ok = await cancellableWait(2500);
    if (!ok) return;

    await checkWord(index + 1);
  }

  // === SCORING & NAME ===
  function handleScoreSubmit() {
    if (!wordList) return;
    const total = wordList.words.length;
    const msg = getScoreMessage(score, total);
    setScoreMessage(msg);

    // Confetti for great scores!
    if (score >= total * 0.8) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }

    setView("name-entry");
  }

  async function handleNameSubmit() {
    if (!childName.trim()) {
      setError("Please enter your name");
      return;
    }

    // Save name for next time
    localStorage.setItem(`spelling-bee-name-${groupId}`, childName.trim());

    setSubmittingScore(true);
    setError("");

    try {
      const res = await fetch(`/api/groups/${groupId}/practice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          child_name: childName.trim(),
          score,
          total: wordList?.words.length || 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
        return;
      }

      await loadLeaderboard();
      setView("leaderboard");
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSubmittingScore(false);
    }
  }

  // === STORY ===

  // Strip markdown formatting from story text
  function cleanStory(raw: string): string {
    return raw
      .replace(/^#+\s+.*$/gm, "")  // Remove markdown headings
      .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold
      .replace(/\*(.*?)\*/g, "$1")     // Remove italic
      .replace(/\n{3,}/g, "\n\n")     // Collapse multiple newlines
      .trim();
  }

  async function playStory() {
    if (!wordList?.story) return;
    setView("story");
    await playAudio(cleanStory(wordList.story), audioKey("story"));
  }

  // Highlight spelling words in story text
  function highlightWordsInStory(story: string, words: string[]): JSX.Element[] {
    const cleaned = cleanStory(story);
    if (!words.length) return [<span key="0">{cleaned}</span>];

    // Build a regex that matches any of the spelling words (case-insensitive, word boundaries)
    const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const regex = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");

    const parts: JSX.Element[] = [];
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = regex.exec(cleaned)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={key++}>{cleaned.slice(lastIndex, match.index)}</span>);
      }
      parts.push(
        <span key={key++} className="font-black text-purple-700 bg-purple-100 rounded px-0.5">
          {match[0]}
        </span>
      );
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < cleaned.length) {
      parts.push(<span key={key++}>{cleaned.slice(lastIndex)}</span>);
    }
    return parts;
  }

  // === RENDER ===
  const words = wordList?.words || [];
  const currentWord = words[currentWordIndex] || "";
  const checkingWord = words[checkingIndex] || "";
  const total = words.length;

  return (
    <div className="space-y-6">
      {/* Confetti overlay */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-2xl"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `confetti ${1.5 + Math.random() * 2}s ease-out forwards`,
                animationDelay: `${Math.random() * 0.5}s`,
              }}
            >
              {["🌟", "⭐", "🎉", "🐝", "✨", "🍯", "🎊"][i % 7]}
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="rounded-2xl bg-white/80 backdrop-blur px-4 py-2.5 text-purple-600 shadow-md hover:bg-white hover:shadow-lg transition-all font-bold text-lg active:scale-95"
        >
          &larr;
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black text-purple-700 truncate">
            {groupName || "Spelling Group"}
          </h1>
          <p className="text-sm font-semibold text-amber-600">Spelling Bee 🐝</p>
        </div>
        <div className="animate-float flex-shrink-0">
          <MiniBee />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border-2 border-red-200 p-4 text-red-700 text-center font-semibold animate-pop-in">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline text-sm">
            dismiss
          </button>
        </div>
      )}

      {/* LOADING */}
      {view === "loading" && (
        <div className="text-center py-12 animate-pop-in">
          <div className="animate-float inline-block">
            <Bee size={80} />
          </div>
          <p className="mt-4 text-amber-600 font-bold text-lg">Loading the hive...</p>
        </div>
      )}

      {/* UPLOAD */}
      {view === "upload" && (
        <div className="space-y-4 animate-slide-up">
          <div className="fun-card space-y-5">
            <h2 className="text-xl font-black text-purple-700">
              📋 Upload This Week&apos;s Spellings
            </h2>

            {/* Photo upload */}
            <label className="block rounded-2xl border-3 border-dashed border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-5 text-center cursor-pointer hover:from-amber-100 hover:to-yellow-100 transition-all active:scale-[0.98]">
              <span className="text-5xl block mb-2">📷</span>
              <span className="text-lg font-bold text-amber-700">
                {ocrProcessing ? "Reading photo..." : "Take a photo of the spelling sheet"}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
                disabled={ocrProcessing}
              />
              {ocrProcessing && (
                <div className="mt-3">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-amber-300 border-t-amber-600" />
                </div>
              )}
            </label>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-amber-200" />
              <span className="text-amber-400 font-bold text-sm">OR TYPE THEM IN</span>
              <div className="h-px flex-1 bg-amber-200" />
            </div>

            <textarea
              value={manualWords}
              onChange={(e) => setManualWords(e.target.value)}
              placeholder={"beautiful\nbecause\nbelieve\n..."}
              rows={8}
              className="w-full rounded-2xl border-2 border-amber-200 bg-amber-50/50 px-4 py-3 text-lg font-semibold focus:border-purple-400 focus:bg-white focus:outline-none font-mono transition-all"
            />
            <p className="text-sm text-gray-500 font-medium">One word per line, or separated by commas</p>

            <button
              onClick={() => submitWords()}
              disabled={uploading || !manualWords.trim()}
              className="btn-honey w-full disabled:opacity-50"
            >
              {uploading ? "Uploading... 🐝" : "Save Spellings 🍯"}
            </button>
          </div>

          {/* Password prompt modal */}
          {showPasswordPrompt && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="fun-card max-w-sm w-full space-y-4 animate-pop-in">
                <h3 className="text-lg font-black text-purple-700">
                  🔒 Words Already Uploaded
                </h3>
                <p className="text-gray-600 font-medium">
                  This week&apos;s spellings have already been uploaded. Enter the admin
                  password to replace them.
                </p>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                  placeholder="Admin password"
                  className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 text-lg focus:border-purple-400 focus:outline-none"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handlePasswordSubmit}
                    className="btn-primary flex-1"
                  >
                    Submit
                  </button>
                  <button
                    onClick={() => {
                      setShowPasswordPrompt(false);
                      setPassword("");
                    }}
                    className="rounded-2xl bg-gray-100 px-5 py-3 font-bold text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GENERATING */}
      {view === "generating" && (
        <div className="text-center py-12 space-y-4 animate-pop-in">
          <div className="animate-wiggle inline-block">
            <Bee size={80} />
          </div>
          <p className="text-2xl font-black text-purple-700">
            Cooking up silly sentences...
          </p>
          <p className="text-amber-600 font-semibold">This only happens once — bee patient! 🍯</p>
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-amber-200 border-t-amber-500" />
        </div>
      )}

      {/* DASHBOARD */}
      {view === "dashboard" && wordList && (
        <div className="space-y-4 animate-slide-up">
          {/* Word list preview */}
          <div className="fun-card">
            <h2 className="text-lg font-black text-purple-700 mb-3">
              🍯 This Week&apos;s Words ({words.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {words.map((word, i) => (
                <span key={i} className="word-pill animate-pop-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  {word}
                </span>
              ))}
            </div>
          </div>

          {/* Practice button */}
          <button
            onClick={() => setView("practice-setup")}
            className="w-full btn-primary py-6 text-2xl relative overflow-visible"
          >
            <span className="relative z-10">Start Practising! 🐝</span>
          </button>

          {/* Leaderboard preview */}
          {leaderboard.length > 0 && (
            <div className="fun-card">
              <h2 className="text-lg font-black text-purple-700 mb-3">
                🏆 Practice Leaderboard This Week
              </h2>
              <div className="space-y-2">
                {leaderboard.slice(0, 10).map((entry, i) => (
                  <div key={i} className="leaderboard-row">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-black text-purple-600 w-8">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                      </span>
                      <span className="font-bold capitalize text-lg">{entry.child_name}</span>
                    </div>
                    <span className="rounded-full bg-amber-200 px-4 py-1 text-amber-800 font-black text-sm">
                      {entry.practice_count}x
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Re-upload option */}
          <button
            onClick={() => {
              setView("upload");
              setManualWords(words.join("\n"));
            }}
            className="w-full rounded-2xl border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm text-gray-500 hover:bg-white hover:border-gray-300 transition-all font-semibold"
          >
            ✏️ Need to correct the word list? Upload again
          </button>
        </div>
      )}

      {/* PRACTICE SETUP */}
      {view === "practice-setup" && (
        <div className="space-y-6 animate-slide-up">
          <div className="fun-card space-y-6">
            <div className="text-center">
              <div className="animate-float inline-block">
                <Bee size={70} />
              </div>
              <h2 className="text-2xl font-black text-purple-700 mt-2">
                Get Ready!
              </h2>
            </div>

            {/* Timer preset buttons — much better than a slider on mobile */}
            <div className="space-y-3">
              <label className="block text-center text-lg font-bold text-gray-700">
                How long to write each word?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {TIMER_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setSeconds(preset.value)}
                    className={`rounded-2xl py-3 px-2 text-center font-bold transition-all active:scale-95 ${
                      seconds === preset.value
                        ? "bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg scale-105"
                        : "bg-white border-2 border-gray-200 text-gray-600 hover:border-purple-300"
                    }`}
                  >
                    <span className="text-2xl block">{preset.label}</span>
                    <span className={`text-xs ${seconds === preset.value ? "text-purple-200" : "text-gray-400"}`}>
                      {preset.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 p-4">
              <p className="font-black text-amber-700 mb-2">How it works:</p>
              <ol className="space-y-1.5 text-sm font-semibold text-amber-800">
                <li className="flex items-start gap-2">
                  <span className="text-base mt-0.5">🔊</span>
                  <span>You&apos;ll hear each word and a silly sentence</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-base mt-0.5">✏️</span>
                  <span>Write it down — pause or skip ahead any time</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-base mt-0.5">🔤</span>
                  <span>Then we&apos;ll check every word together, letter by letter</span>
                </li>
              </ol>
            </div>

            <button
              onClick={startPractice}
              className="btn-go w-full"
            >
              Let&apos;s Go! 🚀
            </button>

            <button
              onClick={() => setView("dashboard")}
              className="w-full text-gray-500 py-2 hover:text-gray-700 font-semibold"
            >
              ← Back
            </button>
          </div>
        </div>
      )}

      {/* PRACTICING — Phase 1: words + sentences + writing */}
      {view === "practicing" && (
        <div className="space-y-5 animate-slide-up">
          {/* Progress bar */}
          <div className="flex items-center gap-1.5">
            {words.map((_, i) => (
              <div
                key={i}
                className={`progress-dot ${
                  i < currentWordIndex ? "done" : i === currentWordIndex ? "active" : "pending"
                }`}
              />
            ))}
          </div>

          <div className="fun-card text-center space-y-3">
            <p className="text-sm font-bold text-amber-600">
              Word {currentWordIndex + 1} of {total}
            </p>

            {practicePhase === "reading" && (
              <div className="py-8 animate-pop-in">
                <div className="text-7xl mb-4 animate-float-slow">🔊</div>
                <p className="text-2xl font-black text-purple-700">
                  Listen carefully...
                </p>
              </div>
            )}

            {practicePhase === "sentence" && (
              <div className="py-5 animate-pop-in">
                <div className="text-5xl mb-3 animate-wiggle">😄</div>
                <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 p-5">
                  <p className="text-lg text-gray-700 italic font-semibold leading-relaxed">
                    &ldquo;{currentSentence}&rdquo;
                  </p>
                </div>
              </div>
            )}

            {practicePhase === "writing" && (
              <div className="py-3 animate-pop-in">
                <div className="text-5xl mb-1">✏️</div>
                <p className="text-xl font-black text-purple-700 mb-2">
                  {paused ? "⏸ Paused — take your time!" : "Write it down!"}
                </p>

                {/* Sentence visible as a clear reminder */}
                {currentSentence && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 mb-3">
                    <p className="text-sm text-amber-700 italic font-medium">
                      &ldquo;{currentSentence}&rdquo;
                    </p>
                  </div>
                )}

                {/* Countdown circle */}
                <div className="relative inline-flex items-center justify-center">
                  <svg width="130" height="130" className="-rotate-90">
                    <circle cx="65" cy="65" r="55" fill="none" stroke="#fef3c7" strokeWidth="8" />
                    <circle
                      cx="65"
                      cy="65"
                      r="55"
                      fill="none"
                      stroke={paused ? "#f59e0b" : "#7c3aed"}
                      strokeWidth="8"
                      strokeDasharray="346"
                      strokeDashoffset={346 - (countdown / seconds) * 346}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <span className={`absolute text-4xl font-black ${paused ? "text-amber-600" : "text-purple-700"}`}>
                    {paused ? "⏸" : countdown}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={togglePause}
                    className={`flex-1 rounded-2xl px-3 py-3 text-base font-black transition-all active:scale-95 ${
                      paused
                        ? "bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-lg"
                        : "bg-amber-100 text-amber-700 border-2 border-amber-300"
                    }`}
                  >
                    {paused ? "▶ Resume" : "⏸ Pause"}
                  </button>
                  <button
                    onClick={skipToNext}
                    className="flex-1 rounded-2xl px-3 py-3 text-base font-black bg-purple-100 text-purple-700 border-2 border-purple-300 transition-all active:scale-95"
                  >
                    Done ➜
                  </button>
                </div>
              </div>
            )}

            {practicePhase === "next" && (
              <div className="py-8 animate-pop-in">
                <div className="text-6xl">✅</div>
                <p className="mt-2 font-bold text-green-600">On to the next one!</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            {currentWordIndex > 0 && (
              <button
                onClick={goBackOneWord}
                className="flex-1 rounded-2xl bg-white/80 backdrop-blur border-2 border-purple-200 px-4 py-3 font-bold text-purple-600 active:scale-95 transition-all"
              >
                ← Previous
              </button>
            )}
            <button
              onClick={repeatCurrentWord}
              className="flex-1 rounded-2xl bg-white/80 backdrop-blur border-2 border-amber-200 px-4 py-3 font-bold text-amber-600 active:scale-95 transition-all"
            >
              🔄 Repeat
            </button>
          </div>

          <button
            onClick={() => {
              stopPractice();
              setView("dashboard");
            }}
            className="w-full text-sm text-gray-400 py-2 hover:text-gray-600 font-semibold"
          >
            Stop and go back
          </button>
        </div>
      )}

      {/* TRANSITION TO CHECKING */}
      {view === "transition-to-checking" && (
        <div className="text-center py-10 space-y-5 animate-pop-in">
          <div className="animate-wiggle inline-block">
            <Bee size={90} />
          </div>
          <h2 className="text-3xl font-black text-purple-700">
            Great work! 🎉
          </h2>
          <p className="text-xl font-semibold text-amber-700">
            Now let&apos;s check your spellings...
          </p>
          <p className="text-gray-500 font-medium">
            Get your pencil ready to mark each one ✏️
          </p>
        </div>
      )}

      {/* CHECKING — Phase 2: spell out each word letter by letter */}
      {view === "checking" && (
        <div className="space-y-5 animate-slide-up">
          {/* Progress */}
          <div className="flex items-center gap-1.5">
            {words.map((_, i) => (
              <div
                key={i}
                className={`progress-dot ${
                  i < checkingIndex ? "done" : i === checkingIndex ? "active" : "pending"
                }`}
              />
            ))}
          </div>

          <div className="fun-card text-center space-y-4">
            <div className="rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 px-4 py-2 inline-block">
              <p className="text-sm font-black text-purple-600">
                🔤 Checking Word {checkingIndex + 1} of {total}
              </p>
            </div>

            <div className="py-4 animate-pop-in">
              {/* Letter tiles */}
              <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 p-4 mb-4">
                <div className="flex justify-center gap-1 flex-wrap">
                  {checkingWord.split("").map((letter, i) => (
                    <span
                      key={i}
                      className={`inline-flex text-2xl sm:text-3xl font-black transition-all duration-300 w-8 h-10 sm:w-10 sm:h-12 items-center justify-center rounded-xl ${
                        i < highlightedLetters
                          ? "text-purple-700 bg-purple-100 scale-110 border-2 border-purple-300 shadow-sm"
                          : "text-gray-300 bg-gray-50 border-2 border-gray-200"
                      }`}
                    >
                      {i < highlightedLetters ? letter.toUpperCase() : "?"}
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-lg font-bold text-gray-600">
                {highlightedLetters === 0
                  ? "Listen for the spelling..."
                  : highlightedLetters < checkingWord.length
                  ? "Check each letter..."
                  : `✅ ${checkingWord.toUpperCase()}`
                }
              </p>
            </div>

            {/* Pause */}
            <button
              onClick={togglePause}
              className={`w-full rounded-2xl px-4 py-3 text-base font-black transition-all active:scale-95 ${
                paused
                  ? "bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-lg"
                  : "bg-purple-100 text-purple-700 border-2 border-purple-300"
              }`}
            >
              {paused ? "▶ Resume" : "⏸ Pause"}
            </button>
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            {checkingIndex > 0 && (
              <button
                onClick={goBackOneWord}
                className="flex-1 rounded-2xl bg-white/80 backdrop-blur border-2 border-purple-200 px-4 py-3 font-bold text-purple-600 active:scale-95 transition-all"
              >
                ← Previous
              </button>
            )}
            <button
              onClick={repeatCurrentWord}
              className="flex-1 rounded-2xl bg-white/80 backdrop-blur border-2 border-amber-200 px-4 py-3 font-bold text-amber-600 active:scale-95 transition-all"
            >
              🔄 Repeat
            </button>
          </div>

          <button
            onClick={() => {
              stopPractice();
              setView("dashboard");
            }}
            className="w-full text-sm text-gray-400 py-2 hover:text-gray-600 font-semibold"
          >
            Stop and go back
          </button>
        </div>
      )}

      {/* SCORING */}
      {view === "scoring" && (
        <div className="space-y-4 animate-slide-up">
          <div className="fun-card text-center space-y-5">
            <div className="text-7xl animate-pop-in">🎉</div>
            <h2 className="text-3xl font-black text-purple-700">
              Well Done!
            </h2>
            <p className="text-gray-600 font-semibold text-lg">
              How many did you get right?
            </p>

            {/* Score grid — much easier than +/- buttons */}
            <div className="grid grid-cols-5 gap-2 max-w-xs mx-auto">
              {Array.from({ length: total + 1 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setScore(i)}
                  className={`h-12 rounded-xl text-lg font-black transition-all active:scale-90 ${
                    score === i
                      ? "bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg scale-110"
                      : "bg-gray-100 text-gray-600 border-2 border-gray-200 hover:border-purple-300"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
            <p className="text-gray-500 font-bold">
              {score} out of {total} {score === total ? "— perfect! 🌟" : ""}
            </p>

            <button onClick={handleScoreSubmit} className="btn-primary w-full">
              Next ➜
            </button>
          </div>
        </div>
      )}

      {/* NAME ENTRY */}
      {view === "name-entry" && (
        <div className="space-y-4 animate-slide-up">
          <div className="fun-card text-center space-y-5">
            <div className="animate-pop-in">
              <p className="text-5xl mb-2">
                {score === total ? "🌟" : score >= total * 0.8 ? "🎉" : score >= total * 0.5 ? "💪" : "🌈"}
              </p>
              <p className="text-xl font-black text-purple-700">{scoreMessage}</p>
            </div>

            <div className="space-y-3">
              <label className="block text-lg font-bold text-gray-700">
                What&apos;s your first name?
              </label>
              <input
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
                placeholder="e.g. Zac"
                className="w-full rounded-2xl border-2 border-amber-200 bg-amber-50/50 px-4 py-4 text-2xl text-center font-bold focus:border-purple-400 focus:bg-white focus:outline-none transition-all"
                autoFocus
                autoCapitalize="words"
              />
              {childName && (
                <p className="text-xs text-gray-400">
                  We&apos;ll remember this for next time
                </p>
              )}
            </div>

            <button
              onClick={handleNameSubmit}
              disabled={submittingScore || !childName.trim()}
              className="btn-honey w-full disabled:opacity-50"
            >
              {submittingScore ? "Saving... 🐝" : "See Leaderboard 🏆"}
            </button>
          </div>
        </div>
      )}

      {/* LEADERBOARD */}
      {view === "leaderboard" && (
        <div className="space-y-4 animate-slide-up">
          <div className="fun-card space-y-4">
            <div className="text-center">
              <p className="text-4xl mb-1">🏆</p>
              <h2 className="text-2xl font-black text-purple-700">
                Practice Leaderboard
              </h2>
              <p className="text-sm font-semibold text-amber-600">
                Who&apos;s been practising this week?
              </p>
            </div>

            {leaderboard.length > 0 ? (
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <div
                    key={i}
                    className={`leaderboard-row animate-slide-up ${
                      entry.child_name.toLowerCase() === childName.toLowerCase().trim()
                        ? "highlighted"
                        : ""
                    }`}
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-black w-10">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                      </span>
                      <span className="font-bold capitalize text-lg">{entry.child_name}</span>
                    </div>
                    <span className="rounded-full bg-amber-200 px-4 py-1 text-amber-800 font-black">
                      {entry.practice_count} {entry.practice_count === 1 ? "time" : "times"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-3xl mb-2">⭐</p>
                <p className="font-bold text-purple-600">
                  You&apos;re the first to practise this week!
                </p>
              </div>
            )}
          </div>

          {/* Story button */}
          {wordList?.story && (
            <button onClick={playStory} className="btn-honey w-full">
              📖 Hear the Silly Story!
            </button>
          )}

          {/* Practice again */}
          <button
            onClick={() => {
              setScore(0);
              setView("practice-setup");
            }}
            className="btn-primary w-full"
          >
            🔄 Practise Again
          </button>

          <Link
            href="/"
            className="block w-full text-center rounded-2xl border-2 border-gray-200 bg-white/50 px-4 py-3 text-gray-500 hover:bg-white hover:border-gray-300 transition-all font-semibold"
          >
            ← Back to Groups
          </Link>
        </div>
      )}

      {/* STORY — with highlighted spelling words */}
      {view === "story" && wordList?.story && (
        <div className="space-y-4 animate-slide-up">
          <div className="fun-card space-y-4">
            <div className="text-center">
              <p className="text-4xl mb-1">📖</p>
              <h2 className="text-2xl font-black text-purple-700">
                The Silly Story
              </h2>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 p-5 text-lg leading-relaxed text-gray-800 font-medium">
              {highlightWordsInStory(wordList.story, words)}
            </div>
            <p className="text-sm text-amber-600 text-center font-bold">
              🔍 The spelling words are highlighted in <span className="text-purple-700">purple</span>!
            </p>
          </div>

          <button
            onClick={() => setView("leaderboard")}
            className="btn-primary w-full"
          >
            ← Back to Leaderboard
          </button>

          <Link
            href="/"
            className="block w-full text-center rounded-2xl border-2 border-gray-200 bg-white/50 px-4 py-3 text-gray-500 hover:bg-white hover:border-gray-300 transition-all font-semibold"
          >
            Back to Groups
          </Link>
        </div>
      )}
    </div>
  );
}
