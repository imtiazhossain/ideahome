/**
 * Dev-only override for the in-app WebView URL when testing on a physical device.
 * - Leave as `null` to use http://localhost:3000 (works in simulator).
 * - Set to your Mac's LAN URL (e.g. "http://192.168.1.10:3000") so the device
 *   can reach the Next.js app. Run `pnpm dev:web` and ensure phone and Mac are on the same Wi‑Fi.
 */
const devWebUrlOverride: string | null = "http://192.168.68.106:3000";

export function getDevWebUrlOverride(): string | null {
  return devWebUrlOverride;
}
