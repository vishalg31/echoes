# Echoes

A taste-driven music discovery game. Answer a few quick questions and Echoes builds you a world of music to explore: chase a song's vibe across artists, or dig into one artist's deep cuts and best-known tracks. Every page is art-led and shifts colour with whatever is playing.

Live at [echoes.vishalbuilds.com](https://echoes.vishalbuilds.com).

## Two ways to play

- **Artist Deep Dive** — go deep on an artist you already love. Echoes surfaces their well-known tracks and lesser-heard cuts so you can explore the full catalogue.
- **Taste Match** — start from a single song and chase its vibe across the whole map. Each pick adds to a growing session chain you can share.

As you play, songs you recognise build a taste profile: your genres, your eras, your rarest finds, and a library of what you have discovered.

## How it works

- **Onboarding** captures your favourite artist, three songs you love, a favourite album, and the decade that feels like home. That seeds your first set of recommendations and your theme.
- **Theming** is art-led. Each decade has its own hand-tuned palette, and while a track plays the page tint follows the album art (extracted with `node-vibrant`).
- **Your profile** lives entirely in your browser. There are no accounts and nothing is sent to a server to store. You can share a link that carries your taste profile encoded in the URL.

## Stack

- [Next.js 15](https://nextjs.org/) (App Router) and React 19
- [Framer Motion](https://www.framer.com/motion/) for animation and the swipe deck
- [Dexie](https://dexie.org/) (IndexedDB) for local-first persistence
- [node-vibrant](https://github.com/Vibrant-Colors/node-vibrant) for album-art colour extraction
- Plain JS/JSX with CSS Modules and CSS custom properties
- Deployed on [Vercel](https://vercel.com/)

## Data sources

Echoes pulls music data through a set of server-side proxy routes (`app/api/`) so keys stay off the client:

- **iTunes Search** — artist, album, and track search, cover art, and the 30-second audio previews
- **Last.fm** — genre tags, artist/album/track info, and search
- **Cover Art Archive** — album cover fallbacks
- **Wikipedia** — artist summaries for the info sheets

Only Last.fm needs a key. iTunes, Cover Art Archive, and Wikipedia are keyless.

## Getting started

```bash
# 1. install
npm install

# 2. add your key
cp .env.local.example .env.local
# then set LASTFM_API_KEY in .env.local

# 3. run (dev server is on port 3009)
npm run dev
```

Open [http://localhost:3009](http://localhost:3009).

### Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `LASTFM_API_KEY` | Yes | Genre tags, artist/album/track info, search |
| `RECCOBEATS_API_KEY` | No | Optional, reserved for a later version |

## Scripts

- `npm run dev` — start the dev server on port 3009
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — lint

## Project structure

```
app/            App Router pages, layout, and the API proxy routes
components/
  onboarding/   the intro quiz
  reveal/       the theme reveal moment
  game/         the two game modes, song cards, search, share
  profile/      the post-quiz home (Your World, Play, Stats)
  ui/           shared bits (marquee, confirm dialog)
lib/            data fetching, theming, recommendations, persistence
```
