# Production-Ready Camera-Based MCQ Solver Web App

A clean, fast, mobile-first web application designed to instantly solve Multiple Choice Questions (MCQs) captured via phone camera or uploaded from gallery using **Google Gemini Vision API**.

---

## 🌟 Key Features

- **📱 Mobile-First Camera UX**: Native camera interface using `getUserMedia` with default rear camera (`facingMode: "environment"`), switch camera option, and manual file upload fallback.
- **⚡ Client-Side Image Compression**: Automatic canvas downscaling to optimize payload sizes and guarantee fast network transmission.
- **🤖 Server-Side Gemini Vision Integration**: Hidden API keys behind Next.js Route Handler (`/api/solve`) with strict JSON schema outputs.
- **⏱️ Server-Side Cooldown Limiter**: Enforced 30-second cooldown per client IP/session to prevent rapid spamming.
- **🔒 Production Security**: Zero API key exposure to browser bundles, strict payload validation, and non-leaking error responses.
- **🎯 Visual Answer Display**: Clear letter badge, option text highlight, confidence level indicator (HIGH/MEDIUM/LOW), and concise explanation.

---

## 🚀 Step-by-Step Free Deployment Guide

Deploying this app to Vercel is **100% Free** and takes less than 5 minutes.

### Step 1: Get Your Free Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **Get API key** -> **Create API key**.
4. Copy your generated `GEMINI_API_KEY`.

---

### Step 2: Push Code to GitHub

1. Open your terminal in the project directory (`d:\Web`).
2. Initialize Git (if not already initialized):
   ```bash
   git init
   git add .
   git commit -m "Initial commit - MCQ Solver Web App"
   ```
3. Create a new repository on [GitHub](https://github.com/new) named `mcq-solver`.
4. Link your local code to GitHub and push:
   ```bash
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/mcq-solver.git
   git branch -M main
   git push -u origin main
   ```

---

### Step 3: Deploy to Vercel for Free

1. Go to [Vercel](https://vercel.com/) and sign up / log in with your **GitHub account**.
2. Click **Add New...** -> **Project**.
3. Select your `mcq-solver` repository from the GitHub list and click **Import**.
4. Expand the **Environment Variables** section and add the following:

   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `GEMINI_API_KEY` | `your_actual_gemini_api_key` | Secret key from Google AI Studio |
   | `GEMINI_MODEL` | `gemini-2.0-flash` | Fast vision model |
   | `COOLDOWN_SECONDS` | `30` | 30s rate limit |

5. Click **Deploy**.
6. In ~1 minute, Vercel will give you a live HTTPS web URL (e.g. `https://mcq-solver-xxx.vercel.app`).
7. Open the URL on your mobile phone camera or desktop browser!

---

## 🛠️ Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Local Environment (`.env.local`)
Create `.env.local`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
COOLDOWN_SECONDS=30
```

### 3. Start Development Server
```bash
npm run dev
```
Open `http://localhost:3000`.

---

## 📂 Project Structure

```text
mcq-solver/
├── app/
│   ├── api/
│   │   └── solve/
│   │       └── route.ts          # Server-side API route handler
│   ├── components/
│   │   ├── CameraView.tsx        # HTML5 MediaDevices rear-camera preview & capture
│   │   ├── ImagePreview.tsx      # Captured image review screen
│   │   ├── AnswerCard.tsx        # Answer, option highlight & explanation card
│   │   ├── LoadingState.tsx      # Processing UI indicator
│   │   └── RateLimitTimer.tsx    # Live countdown timer for active cooldowns
│   ├── page.tsx                  # Main app state orchestrator
│   ├── layout.tsx                # App root layout & SEO metadata
│   └── globals.css               # Tailwind CSS imports & global styles
├── lib/
│   ├── gemini.ts                 # Gemini Vision API integration & prompt engineering
│   ├── rateLimit.ts              # Server-side 30s cooldown tracker
│   ├── validation.ts             # Input payload & image format/size validator
│   ├── imageUtils.ts             # Canvas client-side compression helpers
│   └── types.ts                  # Shared TypeScript interfaces
├── .env.example                  # Environment template
├── README.md                     # Setup & Free Deployment Guide
└── ...
```
