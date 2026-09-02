# Lever

Lever is a generative slot machine for software ideas: **[PRODUCT] for [NICHE AUDIENCE]**.

## Setup

```bash
npm i
cp .env.example .env.local
# Add your Anthropic API key to .env.local
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## How it works

Each pull asks Anthropic to generate fresh product and audience reels on the
server. A cryptographic seed and a randomly selected creative mode keep each
spin unpredictable, while recent results are sent as local exclusions. There
is no static word bank; the browser only animates and stores recent finals.
