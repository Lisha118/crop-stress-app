// ---------------------------------------------------------------------------
// Live climate for the farmer's location, via Open-Meteo (free, no API key).
// https://open-meteo.com/en/docs
// ---------------------------------------------------------------------------
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export class PlaceNotFoundError extends Error {
  constructor(query) {
    super(`No place found for "${query}"`);
    this.query = query;
  }
}

// Village / town / city name -> up to 5 matching places with coordinates.
export async function searchPlaces(query, signal) {
  const params = new URLSearchParams({ name: query, count: "5", language: "en", format: "json" });
  const res = await fetch(`${GEOCODE_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`Location search failed (${res.status})`);
  const data = await res.json();
  return (data.results ?? []).map((p) => ({
    name: p.name,
    region: [p.admin1, p.country].filter(Boolean).join(", "),
    latitude: p.latitude,
    longitude: p.longitude,
  }));
}

// Best match for free-typed text, used when the user doesn't pick a suggestion.
export async function resolvePlace(query, signal) {
  const [best] = await searchPlaces(query, signal);
  if (!best) throw new PlaceNotFoundError(query);
  return best;
}

const HOURS_AHEAD = 24;

// Current conditions, today's totals, the next 24 hours and the week ahead for a place.
// Places saved without coordinates (location service was unreachable at sign-in) are looked up first.
// All times are local at the place, e.g. "2026-09-12T21:45".
export async function loadClimate(place, signal) {
  const located = place.latitude == null ? await resolvePlace(place.name, signal) : place;
  const params = new URLSearchParams({
    latitude: located.latitude,
    longitude: located.longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
    hourly: "temperature_2m,weather_code,wind_speed_10m,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,daylight_duration,uv_index_max",
    forecast_days: "7",
    timezone: "auto",
  });
  const res = await fetch(`${FORECAST_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`Weather lookup failed (${res.status})`);
  const { current, hourly, daily } = await res.json();

  // Hourly rows start at midnight; skip to the current hour (same-format local times compare as text).
  const thisHour = current.time.slice(0, 13);
  const first = Math.max(0, hourly.time.findIndex((time) => time.slice(0, 13) >= thisHour));
  const hours = hourly.time.slice(first, first + HOURS_AHEAD).map((time, i) => ({
    time,
    temperature: Math.round(hourly.temperature_2m[first + i]),
    weatherCode: hourly.weather_code[first + i],
    windSpeed: Math.round(hourly.wind_speed_10m[first + i]),
    isDay: hourly.is_day[first + i] === 1,
  }));

  const days = daily.time.map((date, i) => ({
    date,
    high: Math.round(daily.temperature_2m_max[i]),
    low: Math.round(daily.temperature_2m_min[i]),
    weatherCode: daily.weather_code[i],
    rainChance: daily.precipitation_probability_max[i], // null where the forecast model has none
  }));

  return {
    place: located,
    reading: {
      temperature: Math.round(current.temperature_2m * 10) / 10,
      humidity: Math.round(current.relative_humidity_2m),
      feelsLike: Math.round(current.apparent_temperature),
      windSpeed: Math.round(current.wind_speed_10m),
      rainToday: daily.precipitation_sum[0],
      high: Math.round(daily.temperature_2m_max[0]),
      low: Math.round(daily.temperature_2m_min[0]),
      weatherCode: current.weather_code,
      isDay: current.is_day === 1,
      observedAt: current.time,
      sunrise: daily.sunrise[0],
      sunset: daily.sunset[0],
      daylightSeconds: daily.daylight_duration[0],
      uvIndex: daily.uv_index_max[0], // null where the forecast model has none
    },
    hours,
    days,
  };
}
