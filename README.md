# Spelling Bee

A weekly spelling practice app for primary school children. Parents upload the week's spelling words (by photo or typing), and children practise with natural text-to-speech, silly sentences, a countdown timer, letter-by-letter checking, and a class leaderboard.

## Quick Start

### 1. Set Up Supabase (free)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (any name, choose a region close to you)
3. Once the project is ready, go to **SQL Editor** → **New Query**
4. Paste the contents of `supabase/schema.sql` and click **Run**
5. Go to **Settings** → **API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Get API Keys

- **OpenAI** (for text-to-speech): [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Anthropic** (for sentences, stories, OCR): [console.anthropic.com](https://console.anthropic.com)

> **Note**: If you have enterprise API keys through work, check whether personal/side-project use is permitted. Personal pay-as-you-go accounts are very cheap for this app's volume (under £5/month).

### 3. Configure Environment

```bash
cp .env.local.example .env.local
# Edit .env.local with your keys
```

### 4. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your phone or browser.

## How It Works

### Weekly Cycle
- **Thursday afternoon**: A parent uploads the new spelling list (photo or manual entry)
- **Thursday → Thursday**: Children practise throughout the week
- **Thursday noon**: The list automatically expires, ready for new words

### Practice Flow
1. Choose your spelling group
2. Set the timer (how long to write each word)
3. Hear each word read aloud in a natural voice
4. Hear a silly sentence using the word
5. Write the word before the timer runs out
6. Hear it spelled out letter by letter to check
7. Enter your score and name
8. See the class practice leaderboard
9. Hear a silly story using all the words!

### Admin Features
- First upload each week requires **no password**
- Subsequent uploads (corrections) require the admin password
- Set `ADMIN_PASSWORD` in `.env.local`

## Deploying to Vercel (free)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com), import the repo
3. Add all environment variables from `.env.local` in Vercel's settings
4. Deploy — you'll get a free `.vercel.app` URL

## Cost Estimate

| Component | Per week (30 children, 3 practices each) |
|---|---|
| OpenAI TTS (with caching) | ~£0.20–0.50 |
| Claude Haiku (sentences + story + OCR) | ~£0.01–0.05 |
| Supabase (free tier) | £0 |
| Vercel (free tier) | £0 |
| **Total** | **~£0.25–0.55/week** |

Audio is cached after first generation, so most of the cost comes from the single upload each week.

## Tech Stack

- **Next.js 14** (React framework)
- **Tailwind CSS** (styling)
- **Supabase** (database + file storage)
- **OpenAI TTS** (`tts-1` with `fable` voice)
- **Claude Haiku** (sentence/story generation + photo OCR)
