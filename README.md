# GrowthOps AI

> [!IMPORTANT]
> This project was built with the help of **GEMINI 3 PRO / FLASH** using the **ANTIGRAVITY IDE**.

## Overview

GrowthOps AI is a full-stack application built on the Cloudflare Developer Platform. It combines the power of AI agents with robust workflow automation.

### Tech Stack

- **AI Model**: Google Gemini 3 Flash Preview (`gemini-3-flash-preview`) & Gemini Flash Lite (`gemini-flash-lite-latest`)
- **Frontend**: Vue 3 + Vite + TailwindCSS
- **Backend API**: Cloudflare Workers + Hono
- **Database**: Cloudflare D1
- **Vector Database**: Cloudflare Vectorize
- **Storage**: Cloudflare R2
- **State Management**: Cloudflare Durable Objects & KV
- **Orchestration**: Cloudflare Workflows

## Getting Started

Follow these steps to get the project up and running on your local machine.

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later recommended)
- [npm](https://www.npmjs.com/)
- Cloudflare Account

### Installation

1. **Clone the repository** (if you haven't already):

   ```bash
   git clone <repository-url>
   cd growthopsai
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Login to Cloudflare**:
   You need to be authenticated with Cloudflare to access resources like D1, R2, and AI models.
   ```bash
   npx wrangler login
   ```

### Database Setup (Migrations)

This project uses Cloudflare D1. You need to apply migrations to set up the database schema.

**For Local Development:**

```bash
npm run migrate
```

_This runs `wrangler d1 migrations apply growthopsai --local`_

**For Production (Remote):**

```bash
npm run migrate:remote
```

_This runs `wrangler d1 migrations apply growthopsai --remote`_

> [!NOTE]
> If this is your first time setting up, you might need to create the D1 database, R2 bucket, and Vectorize index if they don't exist in your Cloudflare account, or verify the IDs in `wrangler.jsonc` match your account's resources.

### Running Locally

To start the development server (Frontend + Backend Worker):

```bash
npm run dev
```

This will start Vite, which proxies API requests to the Cloudflare Worker running locally.
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Deployment

To deploy the application to the Cloudflare edge:

```bash
npm run deploy
```

This will build the frontend assets and deploy the Worker.

## Project Structure

- `src/`: Vue 3 Frontend code
- `workers/`: Cloudflare Worker code (API & Workflows)
- `migrations/`: SQL migration files for D1
- `prompt/`: Original prompts used to build this app (Fed into **GEMINI 3 PRO** on **HIGH** setting)
- `wrangler.jsonc`: Cloudflare configuration

---

_Generated with ❤️ by Gemini_
