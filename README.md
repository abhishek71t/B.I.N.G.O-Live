# B.I.N.G.O! Live — Real-Time Multiplayer Web Game

A mobile-first, real-time multiplayer 5×5 number Bingo game built with **React 19 + TypeScript + Tailwind CSS + WebSockets + Express + Firebase Realtime Database**.

---

## How to Play Right Now Over the Internet

The game is already real-time multiplayer! You can test it right away:
1. Open the **Shared App URL** in your browser.
2. Enter your nickname and tap **CREATE ROOM**.
3. Choose the player capacity (`2`, `3`, or `4`), copy the 5-character room code (e.g. `XF3A7`), or tap **Share Invite**.
4. Open the link on your mobile phone or another browser window, tap **JOIN ROOM**, enter the code, and tap **Ready**.
5. You can also tap **+ Add Test Bot** in the waiting room to test with smart AI players anytime!

---

## How to Deploy to a Live Server (Render / Railway / Cloud Run)

To host your own permanent online multiplayer website for free:

### Option A: Deploy on Render (Recommended for WebSockets)
[Render.com](https://render.com) offers free web services that natively support WebSockets out of the box.

1. **Push this code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial BINGO game"
   git remote add origin https://github.com/your-username/bingo-live.git
   git push -u origin main
   ```
2. Go to [dashboard.render.com](https://dashboard.render.com) and click **New + → Web Service**.
3. Connect your GitHub repository.
4. Configure settings:
   - **Name:** `bingo-live` (or your choice)
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. Click **Create Web Service**.
6. Render will build and deploy your app. Once finished, you will receive a public HTTPS URL (e.g. `https://bingo-live.onrender.com`) where you and your friends around the world can open the link and play together in real time!

---

### Option B: Deploy on Railway
[Railway.app](https://railway.app) is another one-click platform for Node.js + WebSocket servers:
1. Create a project from your GitHub repo.
2. Set Build Command: `npm install && npm run build`
3. Set Start Command: `npm start`
4. Railway will automatically assign a domain with WebSocket support enabled.

---

### Option C: Use Firebase Realtime Database
If you prefer Firebase cloud sync instead of hosting a custom WebSocket server:
1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a project.
2. Enable **Authentication → Anonymous Sign-In**.
3. Create a **Realtime Database** in test mode.
4. Copy your config from Project Settings into `.env`:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://your-app-default-rtdb.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=your-app
   ```
5. Deploy the static frontend to **Vercel**, **Netlify**, or **Firebase Hosting** with `npm run build`.

---

## Recommended Firebase Realtime Database Security Rules

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": "auth != null",
        ".write": "auth != null",
        ".validate": "$roomCode.length === 5",
        "maxPlayers": {
          ".validate": "newData.isNumber() && (newData.val() === 2 || newData.val() === 3 || newData.val() === 4)"
        },
        "roomStatus": {
          ".validate": "newData.isString()"
        }
      }
    }
  }
}
```

---

## Local Development

```bash
npm install
npm run dev
```

Server runs on `http://localhost:3000`.
Game Link-->  https://bingo-live-pvgc.onrender.com/
