# ZCheck Verifier Bot

> **Built By Arsh** · For **@RBLXARSH** on YouTube · [discord.gg/NWwZQaFzc5](https://discord.gg/NWwZQaFzc5)

A Discord bot that verifies YouTube channel subscriptions using AI vision. The server admin provides a reference screenshot of their own subscription; the bot uses Google Gemini to visually compare every user's uploaded screenshot against that reference before assigning a role.

ZCheck is pre-configured for Arsh's Discord server — the panel channel, access channel, verified role, and unverified role IDs are baked in, so you only need to upload the reference screenshot to go live.

---

## How It Works

1. **On join:** Every new member is automatically given the **YT Unverified** role (`1527280463427801119`).
2. **Admin runs `/setup`:** Upload a reference screenshot of your own subscription to @RBLXARSH + pick the verified role. The bot analyzes the image with Gemini to extract channel identity, then posts the verification panel.
3. **User clicks Verify:** They upload a screenshot showing their subscription.
4. **Gemini verifies:** Gemini receives both images — the reference and the user's screenshot — and performs a direct side-by-side visual comparison.
5. **On success:** The bot removes the **YT Unverified** role and assigns the **YT Verified** role (`1527281571831353436`).

---

## Bot Responses

| Scenario | Response |
|---|---|
| Not a YouTube screenshot | `Invalid Image.` |
| Wrong YouTube channel | `Invalid Channel, Please Subscribe To the Specified Channel` |
| Correct channel, not subscribed | `Please Subscribe To The Channel First, And Verify Again.` |
| Everything verified ✅ | `Success! You Have Been Verified.` |

---

## Pre-Configured IDs (Arsh's Server)

These are baked into the bot at `src/constants.js`. The bot will auto-apply them when it joins the configured guild.

| Constant | Value |
|---|---|
| `ZCHECK_GUILD_ID` | `1167852560602902528` |
| `ZCHECK_OWNER_ID` | `1498693593701945374` |
| `ZCHECK_PANEL_CHANNEL_ID` | `1527279753546043513` (verification channel where people paste the proof) |
| `ZCHECK_ACCESS_CHANNEL_ID` | `1527276336383656007` (get-access channel) |
| `ZCHECK_VERIFIED_ROLE_ID` | `1527281571831353436` (YT Verified) |
| `ZCHECK_UNVERIFIED_ROLE_ID` | `1527280463427801119` (YT Unverified — auto-assigned on join) |
| `ZCHECK_YOUTUBE_HANDLE` | `@RBLXARSH` |
| `ZCHECK_YOUTUBE_URL` | `https://www.youtube.com/@RBLXARSH` |
| `ZCHECK_SUPPORT_INVITE` | `https://discord.gg/NWwZQaFzc5` |

> If you want to use ZCheck for a **different** server, just edit those constants in `src/constants.js`. The bot will then auto-configure itself for that guild instead.

---

## Pterodactyl Installation

The easiest way to host this bot. The egg handles dependency installation automatically — you just upload files and fill in four variables.

### 1. Upload the Bot Files

Upload the contents of this folder to `/home/container/` on your server — everything **except** `node_modules/` and `.env` (the panel manages env variables for you).

### 2. Import the Egg

In your Pterodactyl **Admin Panel**:
- Go to **Nests** → select or create a nest → **Import Egg**
- Upload `egg-zcheck-verifier.json` from this folder

### 3. Create the Server

- Create a new server using the **ZCheck Verifier Bot** egg
- Under **Startup Variables**, fill in:

| Variable | Where to get it |
|---|---|
| `DISCORD_TOKEN` | [discord.com/developers](https://discord.com/developers/applications) → your app → **Bot → Token** |
| `CLIENT_ID` | same page → **General Information → Application ID** |
| `GEMINI_API_KEY` | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| `DATABASE_URL` | your PostgreSQL provider — Supabase, Railway, Neon, etc. |

### 4. Start

Click **Start**. The egg installs npm dependencies on first run, then starts the bot. You'll see `Ready as ZCheck#XXXX` when it's live.

No `.env` file needed — Pterodactyl injects the variables directly.

---

## Manual / VPS Installation

### 1. Create a Discord Application

- Go to [discord.com/developers/applications](https://discord.com/developers/applications) and create a new application named **ZCheck**.
- Under **Bot**, create a bot and copy the **Token**.
- Copy the **Application ID** (this is your `CLIENT_ID`).
- Enable these **Privileged Gateway Intents**: `Server Members Intent`, `Message Content Intent`.
- Invite the bot with these permissions: `Manage Roles`, `Manage Channels`, `Manage Messages`, `Mention Everyone`, `Send Messages`, `View Channels`.

### 2. Get a Gemini API Key

- Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) and create an API key.
- This is your `GEMINI_API_KEY`.

### 3. Set Up PostgreSQL

- Create a PostgreSQL database (Supabase, Railway, Neon, etc.).
- Copy the connection string as your `DATABASE_URL`.
- The bot creates the `guild_configs` table automatically on first run (including the `unverified_role_id` and `logs_channel_id` columns).

### 4. Configure Environment Variables

Copy `example.env` to `.env` and fill in your values:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
GEMINI_API_KEY=your_gemini_api_key
DATABASE_URL=your_postgres_connection_string
```

### 5. Start the Bot

```bash
npm install
node src/index.js
```

---

## Bot Commands

| Command | Description | Who Can Use |
|---|---|---|
| `/setup` | Upload a reference screenshot, configure the verified role, unverified role, panel channel, and support roles | Server owner / extra owners |
| `/extraowner add` | Grant another user permission to run `/setup` | Server owner |
| `/logs` | Set a channel for bot activity logs | Server owner / extra owners |
| `/panel` | Edit the verification panel title, description, and footer | Server owner / extra owners |

---

## First-Time Setup Walkthrough (Arsh's Server)

1. Invite the bot to your Discord server (`1167852560602902528`).
2. Make sure the bot's role is **above** the YT Verified and YT Unverified roles in your role list.
3. Make sure the bot has `Manage Roles`, `Manage Channels`, `Manage Messages`, `View Channels`, and `Send Messages` permissions.
4. Start the bot. You should see `Ready as ZCheck#XXXX` in the console.
5. In your `#verify` channel (`1527279753546043513`), run:
   ```
   /setup reference_image: <your_subscription_screenshot>
           assigning_role: @YT Verified
           panel_channel: #verify
           support_ping_role_1: @Staff
           support_ping_role_2: @Admin
           support_ping_role_3: @Mod
           access_channel: #get-access
           unverified_role: @YT Unverified
   ```
6. The bot will post the verification panel and you're live.

---

## Requirements

- Node.js 20+
- PostgreSQL database (Supabase, Railway, Neon, or any provider)
- Google Gemini API key (free tier supported)
- A Discord bot application named **ZCheck**

---

## Credits

**ZCheck Verifier Bot** — Built By Arsh · Support: [discord.gg/NWwZQaFzc5](https://discord.gg/NWwZQaFzc5)
