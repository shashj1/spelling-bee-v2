/**
 * Returns the next Thursday at noon UK time from the given date.
 * If it's currently Thursday afternoon (after 12:00), returns NEXT Thursday noon.
 * If it's Thursday morning (before 12:00), returns today at noon.
 */
export function getNextThursdayNoon(): Date {
  // Work in UTC and offset for UK time
  const now = new Date();

  // Get current time in UK timezone
  const ukFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = ukFormatter.formatToParts(now);
  const ukDay = now.toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "short" });
  const ukHour = parseInt(parts.find((p) => p.type === "hour")!.value);

  // Thursday = "Thu"
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const currentDayIndex = daysOfWeek.indexOf(ukDay);
  const thursdayIndex = 4; // Thu

  let daysUntilThursday = (thursdayIndex - currentDayIndex + 7) % 7;

  // If it's Thursday and past noon, go to next Thursday
  if (daysUntilThursday === 0 && ukHour >= 12) {
    daysUntilThursday = 7;
  }

  // If it's after Thursday this week, go to next Thursday
  if (daysUntilThursday === 0 && currentDayIndex !== thursdayIndex) {
    daysUntilThursday = 7;
  }

  // Calculate the target date at noon UK time
  const target = new Date(now);
  target.setDate(target.getDate() + daysUntilThursday);

  // Set to noon in UK timezone by creating a date string
  const targetDateStr = target.toLocaleDateString("en-CA", { timeZone: "Europe/London" }); // YYYY-MM-DD
  // Parse as noon UK time
  const noonUK = new Date(`${targetDateStr}T12:00:00+00:00`);

  // Adjust for BST if needed (UK is UTC+1 in summer)
  const ukOffset = getUKOffset(noonUK);
  noonUK.setHours(noonUK.getHours() - ukOffset);

  return noonUK;
}

function getUKOffset(date: Date): number {
  // Determine if UK is in BST (UTC+1) or GMT (UTC+0)
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  const janOffset = -jan.toLocaleString("en-GB", { timeZone: "Europe/London", hour: "numeric", hour12: false }).length;

  // Simple check: format the date in UK timezone and compare with UTC
  const ukHour = parseInt(
    date.toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false })
  );
  const utcHour = date.getUTCHours();
  return (ukHour - utcHour + 24) % 24;
}

/**
 * Check if a word list has expired (past Thursday noon UK time)
 */
export function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) <= new Date();
}

/**
 * Format a score as a percentage
 */
export function scorePercentage(score: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((score / total) * 100);
}

/**
 * Get an encouraging or congratulatory message based on score
 */
export function getScoreMessage(score: number, total: number): string {
  const pct = scorePercentage(score, total);

  if (pct === 100) {
    return "Brilliant! Full marks! You're a spelling superstar! 🌟";
  } else if (pct >= 80) {
    return "Well done! That's a cracking score! Keep it up! 🎉";
  } else if (pct >= 60) {
    return "Good effort! You're getting there — practice makes perfect! 💪";
  } else if (pct >= 40) {
    return "Nice try! Every bit of practice helps. You'll smash it next time! 👍";
  } else {
    return "Well done for practising! That's the most important thing. Have another go — you'll be amazed how much you improve! 🌈";
  }
}
