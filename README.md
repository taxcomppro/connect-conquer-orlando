# Connect & Conquer Orlando

how can we promote join tcpc at the irs forum in orlando next week where we are an exhibitor. reference tax pro connect project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/03f0b690-3d51-48f3-b958-e1a22b2c16d9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## One Field Hub architecture

This repository is the single staff-facing application and backend:

1. The public `/` route contains the training, show briefing, and product demo hub.
2. Authenticated staff use `/scan`, `/leads`, and `/lead/:attendeeId`.
3. The browser sends badge lookups to the same TanStack Start deployment.
4. The server-only lookup calls EDC; the EDC key is never shipped to the browser.
5. Both the UI and server use one Supabase project for authentication and lead data.

Do not deploy a separate static Field Hub in front of this application. Vercel should build this repository from `main`, with the project root set to the repository root.

The Vercel project uses the `Other` framework preset and `bun run build`. The Nitro Vercel preset emits the complete Build Output API bundle under `.vercel/output`, including the server function used for EDC lookups.

### Required environment variables

Copy `.env.example` for local development. Configure the same variable names in Vercel for Production and Preview as appropriate. `EDC_SHOW_ID`, `EDC_API_KEY`, and `EDC_API_URL` are server-only and must never use a `VITE_` prefix.

`EDC_APP_KEY` is accepted temporarily as a backwards-compatible alias, but new deployments should use `EDC_API_KEY`.
