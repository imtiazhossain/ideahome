import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";

type OpenMeteoForecastResponse = {
  current?: {
    time?: unknown;
    temperature_2m?: unknown;
    apparent_temperature?: unknown;
    weather_code?: unknown;
    wind_speed_10m?: unknown;
    precipitation?: unknown;
    is_day?: unknown;
  };
};

type OpenMeteoForwardGeocodeResponse = {
  results?: Array<{
    name?: unknown;
    admin1?: unknown;
    country_code?: unknown;
    latitude?: unknown;
    longitude?: unknown;
  }>;
};

type OpenMeteoReverseGeocodeResponse = {
  results?: Array<{
    name?: unknown;
    city?: unknown;
    admin1?: unknown;
    country_code?: unknown;
  }>;
};

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  label: string;
};

export type CurrentWeather = {
  latitude: number;
  longitude: number;
  locationLabel: string;
  observedAt: string | null;
  temperatureF: number;
  apparentTemperatureF: number;
  condition: string;
  windMph: number;
  precipitationIn: number;
  isDay: boolean;
};

@Injectable()
export class WeatherService {
  private readonly timeoutMs = 12000;

  async getCurrentWeather(latitude: number, longitude: number): Promise<CurrentWeather> {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new BadRequestException("Latitude must be between -90 and 90");
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new BadRequestException("Longitude must be between -180 and 180");
    }

    const [forecast, reverseGeocode] = await Promise.all([
      this.fetchJson<OpenMeteoForecastResponse>(
        "https://api.open-meteo.com/v1/forecast?" +
          new URLSearchParams({
            latitude: latitude.toFixed(4),
            longitude: longitude.toFixed(4),
            current:
              "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation,is_day",
            temperature_unit: "fahrenheit",
            wind_speed_unit: "mph",
            precipitation_unit: "inch",
            timezone: "auto",
          }).toString(),
        "weather forecast"
      ),
      this.fetchJson<OpenMeteoReverseGeocodeResponse>(
        "https://geocoding-api.open-meteo.com/v1/reverse?" +
          new URLSearchParams({
            latitude: latitude.toFixed(4),
            longitude: longitude.toFixed(4),
            language: "en",
            format: "json",
          }).toString(),
        "reverse geocode"
      ).catch(() => null),
    ]);

    const current = forecast.current;
    const temperatureF = this.readNumber(current?.temperature_2m);
    const apparentTemperatureF = this.readNumber(current?.apparent_temperature);
    const windMph = this.readNumber(current?.wind_speed_10m);
    const precipitationIn = this.readNumber(current?.precipitation);
    const weatherCode = this.readNumber(current?.weather_code);
    if (
      temperatureF === null ||
      apparentTemperatureF === null ||
      windMph === null ||
      precipitationIn === null ||
      weatherCode === null
    ) {
      throw new BadGatewayException("Weather provider response was incomplete");
    }

    return {
      latitude,
      longitude,
      locationLabel: this.formatLocationLabel(reverseGeocode),
      observedAt: typeof current?.time === "string" ? current.time : null,
      temperatureF,
      apparentTemperatureF,
      condition: this.describeWeatherCode(weatherCode),
      windMph,
      precipitationIn,
      isDay: Number(current?.is_day) === 1,
    };
  }

  async geocodeCity(query: string): Promise<GeocodeResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      throw new BadRequestException("Location query is required");
    }

    // Step 1: Try the full query as-is (works for single-word cities and
    // some multi-word city names like "New York" or "San Francisco").
    const fullResponse = await this.fetchJson<OpenMeteoForwardGeocodeResponse>(
      "https://geocoding-api.open-meteo.com/v1/search?" +
        new URLSearchParams({
          name: trimmed,
          count: "1",
          language: "en",
          format: "json",
        }).toString(),
      "forward geocode"
    );
    const fullFirst = fullResponse.results?.[0];
    if (fullFirst) {
      return this.buildGeocodeResult(fullFirst, trimmed);
    }

    // Step 2: For multi-word queries like "Blairstown New Jersey", strip
    // trailing words to get the city name, then use the stripped words as
    // context to pick the right result from multiple matches.
    if (/[\s,]/.test(trimmed)) {
      const words = trimmed.split(/[\s,]+/).filter(Boolean);

      // Try stripping last word(s) as state/country context
      for (let dropCount = 1; dropCount < words.length; dropCount++) {
        const cityPart = words.slice(0, words.length - dropCount).join(" ");
        const contextPart = words.slice(words.length - dropCount).join(" ").toLowerCase();

        if (cityPart.length < 2) continue;

        const response = await this.fetchJson<OpenMeteoForwardGeocodeResponse>(
          "https://geocoding-api.open-meteo.com/v1/search?" +
            new URLSearchParams({
              name: cityPart,
              count: "5",
              language: "en",
              format: "json",
            }).toString(),
          "forward geocode with context"
        );
        const results = response.results ?? [];
        if (results.length === 0) continue;

        // Try to find a result whose state/country matches the context
        const contextMatch = results.find((r) => {
          const admin1 = typeof r.admin1 === "string" ? r.admin1.toLowerCase() : "";
          const countryCode = typeof r.country_code === "string" ? r.country_code.toLowerCase() : "";
          return (
            admin1.includes(contextPart) ||
            contextPart.includes(admin1) ||
            countryCode === contextPart
          );
        });

        if (contextMatch) {
          return this.buildGeocodeResult(contextMatch, trimmed);
        }

        // No context match — fall back to the first (most relevant) result
        return this.buildGeocodeResult(results[0], trimmed);
      }
    }

    throw new BadRequestException(
      `Could not find coordinates for "${trimmed}". Try a simpler city name like "Houston" or "London".`
    );
  }

  private buildGeocodeResult(
    result: NonNullable<OpenMeteoForwardGeocodeResponse["results"]>[number],
    fallbackLabel: string
  ): GeocodeResult {
    const latitude = this.readNumber(result.latitude);
    const longitude = this.readNumber(result.longitude);
    if (latitude === null || longitude === null) {
      throw new BadGatewayException("Geocoding provider returned invalid coordinates");
    }
    const name = typeof result.name === "string" ? result.name.trim() : "";
    const admin1 = typeof result.admin1 === "string" ? result.admin1.trim() : "";
    const countryCode =
      typeof result.country_code === "string" ? result.country_code.trim().toUpperCase() : "";
    const parts = [name, admin1 || countryCode].filter(Boolean);
    return {
      latitude,
      longitude,
      label: parts.length > 0 ? parts.join(", ") : fallbackLabel,
    };
  }

  private async fetchJson<T>(url: string, label: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new ServiceUnavailableException(
          `Weather provider request failed for ${label} (${response.status})`
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ServiceUnavailableException(
          `Weather provider timed out after ${this.timeoutMs}ms`
        );
      }
      if (error instanceof BadGatewayException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException("Weather provider network request failed");
    } finally {
      clearTimeout(timer);
    }
  }

  private readNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private formatLocationLabel(response: OpenMeteoReverseGeocodeResponse | null): string {
    const first = response?.results?.[0];
    if (!first) return "your area";
    const name = typeof first.city === "string" ? first.city.trim() : "";
    const fallbackName = typeof first.name === "string" ? first.name.trim() : "";
    const admin1 = typeof first.admin1 === "string" ? first.admin1.trim() : "";
    const countryCode =
      typeof first.country_code === "string" ? first.country_code.trim().toUpperCase() : "";
    const primary = name || fallbackName;
    const parts = [primary, admin1 || countryCode].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "your area";
  }

  private describeWeatherCode(code: number): string {
    if (code === 0) return "clear";
    if (code === 1) return "mostly clear";
    if (code === 2) return "partly cloudy";
    if (code === 3) return "overcast";
    if (code === 45 || code === 48) return "foggy";
    if (code === 51 || code === 53 || code === 55) return "drizzly";
    if (code === 56 || code === 57) return "freezing drizzle";
    if (code === 61 || code === 63 || code === 65) return "rainy";
    if (code === 66 || code === 67) return "freezing rain";
    if (code === 71 || code === 73 || code === 75) return "snowy";
    if (code === 77) return "snow grains";
    if (code === 80 || code === 81 || code === 82) return "showery";
    if (code === 85 || code === 86) return "snow showers";
    if (code === 95) return "thunderstorms";
    if (code === 96 || code === 99) return "thunderstorms with hail";
    return "unsettled";
  }
}
