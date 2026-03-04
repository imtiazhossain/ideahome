# Google Calendar Sync Setup

Configure Google Calendar OAuth credentials in `backend/.env`, then restart backend.

## 1) Google Cloud Console

1. Open [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Create/select a project.
3. Enable **Google Calendar API** for this project.
4. Create **OAuth Client ID** (Web application).
5. Add redirect URIs:
   - Local: `http://localhost:3001/calendar/google/callback`
   - Production: `https://your-backend.example.com/calendar/google/callback`

## 2) Backend environment variables

Add these to `backend/.env`:

```env
GOOGLE_CALENDAR_CLIENT_ID="..."
GOOGLE_CALENDAR_CLIENT_SECRET="..."
GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY="..." # openssl rand -base64 32
# Optional override (default = ${BACKEND_URL}/calendar/google/callback)
GOOGLE_CALENDAR_REDIRECT_URI="http://localhost:3001/calendar/google/callback"
```

## 3) Security notes

- `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY` must decode to **32 bytes** (AES-256-GCM).
- Rotating the key invalidates previously stored encrypted Google tokens.
- Keep OAuth secrets and encryption key only in secure env stores.

## 4) Verify

1. Start app and open `/calendar`.
2. Select a project.
3. Click **Connect Google Calendar**.
4. Approve consent.
5. Confirm connected status, calendar selector, and manual sync work.
