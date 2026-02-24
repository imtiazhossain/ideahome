# SSO setup (Google, GitHub, Apple)

Configure credentials in `backend/.env`. After editing, restart the backend (`pnpm dev:backend`).

---

## Google

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create or select a project.
3. **Create credentials** → **OAuth client ID**.
4. Application type: **Web application**.
5. **Authorized redirect URIs** — add exactly:
   - Local: `http://localhost:3001/auth/google/callback`
   - Production: `https://your-api.example.com/auth/google/callback`
6. Copy **Client ID** and **Client secret** into `backend/.env`:
   ```env
   GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   ```

---

## GitHub

1. Open [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers).
2. **New OAuth App**.
3. **Authorization callback URL**: `http://localhost:3001/auth/github/callback` (or your backend URL + `/auth/github/callback`).
4. Copy **Client ID** and generate **Client secret**; add to `backend/.env`:
   ```env
   GITHUB_CLIENT_ID="..."
   GITHUB_CLIENT_SECRET="..."
   ```

---

## Apple

1. In [Apple Developer](https://developer.apple.com/account): create an **App ID**, then a **Services ID** (this is `APPLE_CLIENT_ID`). Configure Sign in with Apple and set Return URLs to `http://localhost:3001/auth/apple/callback`.
2. Create a **Key** with Sign in with Apple enabled; download the `.p8` file (this is `APPLE_PRIVATE_KEY`; use `\n` for newlines in `.env`).
3. In `backend/.env` set:
   ```env
   APPLE_CLIENT_ID="your-services-id"
   APPLE_TEAM_ID="..."
   APPLE_KEY_ID="..."
   APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
   ```

---

## Redirect URIs summary

| Provider | Redirect URI (local) |
|---------|----------------------|
| Google  | `http://localhost:3001/auth/google/callback`  |
| GitHub  | `http://localhost:3001/auth/github/callback`  |
| Apple   | `http://localhost:3001/auth/apple/callback`   |

For production, replace `http://localhost:3001` with your backend base URL and set `BACKEND_URL` and `FRONTEND_URL` in `backend/.env`.
