import type { CurrentWeather } from "./api";

const WEATHER_QUERY_RE =
  /\b(weather|forecast|temperature|temp|rain|snow|humidity|wind|sunny|cloudy|storm|storms|thunder|hot|cold)\b/i;

export function isWeatherQuery(text: string): boolean {
  return WEATHER_QUERY_RE.test(text);
}

/**
 * Tries to extract a named location from a weather query.
 * Returns the location string (e.g. "Houston Texas") or null if none found.
 * When null, the caller should fall back to GPS.
 */
export function extractWeatherLocation(text: string): string | null {
  const t = text.trim();
  if (!t) return null;

  // "weather in Houston" / "weather in Houston, TX" / "in Tokyo right now"
  const inMatch = /\bweather\b.*?\bin\s+([A-Za-z][A-Za-z\s,.'\-]+?)(?:\s+right\s+now|\s+today|\s+tonight|\s+tomorrow|\?|$)/i.exec(t)
    ?? /\b(?:temperature|forecast|rain|snow|wind|hot|cold)\b.*?\bin\s+([A-Za-z][A-Za-z\s,.'\-]+?)(?:\s+right\s+now|\s+today|\s+tonight|\s+tomorrow|\?|$)/i.exec(t);
  if (inMatch?.[1]) return inMatch[1].trim().replace(/[,\s]+$/, "");

  // "what's it like in Houston?"
  const likeInMatch = /\bin\s+([A-Za-z][A-Za-z\s,.'\-]+?)(?:\s+right\s+now|\s+today|\s+tonight|\s+tomorrow|\?|$)/i.exec(t);
  if (likeInMatch?.[1]) {
    const candidate = likeInMatch[1].trim().replace(/[,\s]+$/, "");
    // Only trust if it doesn't look like a stop phrase
    if (!/^(my area|my location|here|this area)$/i.test(candidate)) {
      return candidate;
    }
  }

  // "Houston Texas weather" / "London weather"
  const prefixMatch = /^([A-Za-z][A-Za-z\s,.'\-]+?)\s+(?:weather|forecast|temperature|temp)\b/i.exec(t);
  if (prefixMatch?.[1]) return prefixMatch[1].trim().replace(/[,\s]+$/, "");

  // "weather for Houston" / "forecast for London UK"
  const forMatch = /\bfor\s+([A-Za-z][A-Za-z\s,.'\-]+?)(?:\s+right\s+now|\s+today|\s+tonight|\s+tomorrow|\?|$)/i.exec(t);
  if (forMatch?.[1]) return forMatch[1].trim().replace(/[,\s]+$/, "");

  return null;
}

export function formatCurrentWeatherSummary(report: CurrentWeather): string {
  const where = report.locationLabel || "your area";
  const temperature = Math.round(report.temperatureF);
  const feelsLike = Math.round(report.apparentTemperatureF);
  const wind = Math.round(report.windMph);
  const precipitation = report.precipitationIn > 0.01
    ? ` Precipitation is around ${report.precipitationIn.toFixed(2)} in.`
    : "";
  const dayNote = report.isDay ? "" : " It looks like nighttime there.";

  return `Right now in ${where} it's ${temperature}°F and ${report.condition}. It feels like ${feelsLike}°F with ${wind} mph wind.${precipitation}${dayNote}`;
}

export function readWeatherErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "I couldn't check the weather right now. Try again.";
  }
  if (/user denied geolocation/i.test(error.message)) {
    return "I can check the weather if you allow location access in your browser and ask again.";
  }
  if (/geolocation/i.test(error.message)) {
    return "I need your location to answer that. Allow location access in your browser and ask again.";
  }
  if (/not found/i.test(error.message)) {
    return "The weather service route was not found on the backend. Please ensure the backend is up to date and has been restarted.";
  }
  return error.message || "I couldn't check the weather right now. Try again.";
}

export function getBrowserPosition(): Promise<{ latitude: number; longitude: number }> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return Promise.reject(new Error("Geolocation is not available in this browser."));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("User denied geolocation."));
          return;
        }
        reject(new Error(error.message || "Geolocation failed."));
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 10 * 60 * 1000,
      }
    );
  });
}
