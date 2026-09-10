import { generateNoaaReport, generateWeatherNarrative, getEnvironment, normalizeLocation } from './src/report-generator.js';

const form = document.querySelector('#weather-form');
const locationInput = document.querySelector('#location-input');
const reportOutput = document.querySelector('#report-output');
const statusText = document.querySelector('#status-text');
const quickPickButtons = document.querySelectorAll('.chip[data-example]');
const formatButtons = document.querySelectorAll('.format-chip');
const themeToggle = document.querySelector('#theme-toggle');

let reportFormat = localStorage.getItem('grid-weather-format') === 'noaa' ? 'noaa' : 'report';
let lastWeather = null;

const US_STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
};

function applyTheme(mode) {
  const shouldUseLight = mode === 'light';
  document.body.classList.toggle('light-mode', shouldUseLight);
  themeToggle.textContent = shouldUseLight ? 'Light Mode' : 'Dark Mode';
  themeToggle.setAttribute('aria-pressed', String(shouldUseLight));
}

if (themeToggle) {
  const savedTheme = localStorage.getItem('grid-weather-theme');
  applyTheme(savedTheme === 'light' ? 'light' : 'dark');

  themeToggle.addEventListener('click', () => {
    const nextMode = document.body.classList.contains('light-mode') ? 'dark' : 'light';
    localStorage.setItem('grid-weather-theme', nextMode);
    applyTheme(nextMode);
  });
}

function setStatus(message, isSuccess = true) {
  statusText.textContent = message;
  const dot = document.querySelector('.status-dot');
  if (dot) {
    dot.style.background = isSuccess ? '#1a7f5a' : '#d97706';
    dot.style.boxShadow = isSuccess ? '0 0 0 5px rgba(26,127,90,0.13)' : '0 0 0 5px rgba(217,119,6,0.15)';
  }
}

function updateReport(text) {
  reportOutput.textContent = text;
  reportOutput.classList.remove('empty');
  reportOutput.classList.toggle('noaa-view', reportFormat === 'noaa');
}

function buildReportHeader(weather) {
  const dailyHighF = Math.round((weather.dailyHighC * 9) / 5 + 32);
  const dailyLowF = Math.round((weather.dailyLowC * 9) / 5 + 32);
  return `${weather.reportPeriodLabel} 12-Hour Weather Forecast Report\nLocation: ${weather.location}\nSource: ${weather.source}\nDaily High: ${dailyHighF}°F\nDaily Low: ${dailyLowF}°F\n\n`;
}

function renderReport(weather) {
  const body = reportFormat === 'noaa' ? generateNoaaReport(weather) : generateWeatherNarrative(weather);
  updateReport(`${buildReportHeader(weather)}${body}`);
}

function applyReportFormat(nextFormat) {
  reportFormat = nextFormat === 'noaa' ? 'noaa' : 'report';
  localStorage.setItem('grid-weather-format', reportFormat);

  formatButtons.forEach((button) => {
    const isActive = button.dataset.format === reportFormat;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  if (lastWeather) {
    renderReport(lastWeather);
  }
}

function formatLocationLabel(location) {
  if (location.type === 'coordinates') {
    return `Grid Coordinates: ${location.lat}, ${location.lon}`;
  }

  if (location.city && location.state) {
    return `${location.city}, ${location.state}`;
  }

  return location.city || 'Requested location';
}

function mapWeatherCode(code) {
  const mapping = {
    0: 'clear sky',
    1: 'partly cloudy',
    2: 'partly cloudy',
    3: 'overcast',
    45: 'foggy',
    48: 'foggy',
    51: 'light drizzle',
    53: 'drizzle',
    55: 'heavy drizzle',
    56: 'freezing drizzle',
    57: 'freezing drizzle',
    61: 'light rain',
    63: 'rain',
    65: 'heavy rain',
    66: 'freezing rain',
    67: 'freezing rain',
    71: 'light snow',
    73: 'snow',
    75: 'heavy snow',
    77: 'sleet',
    80: 'rain showers',
    81: 'heavy rain showers',
    82: 'stormy rain showers',
    85: 'snow showers',
    86: 'heavy snow showers',
    95: 'thunderstorm',
    96: 'thunderstorm',
    99: 'thunderstorm'
  };

  return mapping[code] || 'clear conditions';
}

function getReportPeriodFromGenerationTime(generatedAt = new Date()) {
  const minutesSinceMidnight = generatedAt.getHours() * 60 + generatedAt.getMinutes();
  const daytimeStartMinutes = 4 * 60 + 30;
  const nighttimeStartMinutes = 16 * 60 + 30;
  return minutesSinceMidnight >= daytimeStartMinutes && minutesSinceMidnight < nighttimeStartMinutes ? 'day' : 'night';
}

function getReportPeriodLabel(reportPeriod) {
  return reportPeriod === 'day' ? 'Daytime' : 'Nighttime';
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function toNumericWindow(series, startIndex, endIndex) {
  if (!Array.isArray(series)) {
    return [];
  }

  return series
    .slice(startIndex, endIndex)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function selectDominantWeatherCode(codes) {
  if (!codes.length) {
    return 0;
  }

  const counts = new Map();
  let dominantCode = codes[0];
  let dominantCount = 0;

  for (const code of codes) {
    const nextCount = (counts.get(code) || 0) + 1;
    counts.set(code, nextCount);

    if (nextCount > dominantCount) {
      dominantCount = nextCount;
      dominantCode = code;
    }
  }

  return dominantCode;
}

function build12HourForecastSummary(data) {
  const current = data.current || {};
  const hourly = data.hourly || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  if (!times.length) {
    throw new Error('Hourly forecast data is unavailable.');
  }

  const currentTimeMs = Date.parse(current.time || '');
  let startIndex = 0;

  if (Number.isFinite(currentTimeMs)) {
    const matchingIndex = times.findIndex((timeValue) => Date.parse(timeValue) >= currentTimeMs);
    if (matchingIndex >= 0) {
      startIndex = matchingIndex;
    }
  }

  const endIndex = Math.min(startIndex + 12, times.length);
  if (endIndex <= startIndex) {
    throw new Error('Unable to determine a 12-hour forecast window.');
  }

  const temperatures = toNumericWindow(hourly.temperature_2m, startIndex, endIndex);
  if (!temperatures.length) {
    throw new Error('Temperature forecast data is unavailable.');
  }

  const feelsLikeValues = toNumericWindow(hourly.apparent_temperature, startIndex, endIndex);
  const humidityValues = toNumericWindow(hourly.relative_humidity_2m, startIndex, endIndex);
  const windSpeedValues = toNumericWindow(hourly.wind_speed_10m, startIndex, endIndex);
  const windDirectionValues = toNumericWindow(hourly.wind_direction_10m, startIndex, endIndex);
  const visibilityValues = toNumericWindow(hourly.visibility, startIndex, endIndex);
  const weatherCodeValues = toNumericWindow(hourly.weather_code, startIndex, endIndex);
  const precipProbabilityValues = toNumericWindow(hourly.precipitation_probability, startIndex, endIndex);

  const dominantWeatherCode = selectDominantWeatherCode(weatherCodeValues);

  return {
    tempC: average(temperatures),
    feelsLikeC: feelsLikeValues.length ? average(feelsLikeValues) : average(temperatures),
    humidity: Math.round(humidityValues.length ? average(humidityValues) : 0),
    windSpeedKph: windSpeedValues.length ? average(windSpeedValues) : 0,
    windDirection: windDirectionValues.length ? average(windDirectionValues) : 0,
    weatherCode: dominantWeatherCode,
    lowC: Math.min(...temperatures),
    highC: Math.max(...temperatures),
    precipChance: precipProbabilityValues.length ? Math.max(...precipProbabilityValues) : 0,
    visibilityKm: visibilityValues.length ? average(visibilityValues) / 1000 : 0,
    conditionsSummary: mapWeatherCode(dominantWeatherCode)
  };
}

function buildDailyTemperatureSummary(data) {
  const daily = data.daily || {};
  const dailyTimes = Array.isArray(daily.time) ? daily.time : [];
  const minTemps = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : [];
  const maxTemps = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : [];
  const currentTime = data.current?.time || '';
  const currentDate = currentTime.split('T')[0];
  const dateIndex = currentDate ? dailyTimes.indexOf(currentDate) : -1;
  const summaryIndex = dateIndex >= 0 ? dateIndex : 0;

  return {
    dailyLowC: Number(minTemps[summaryIndex]),
    dailyHighC: Number(maxTemps[summaryIndex])
  };
}

function fToC(tempF) {
  return (tempF - 32) * (5 / 9);
}

function mphToKph(speedMph) {
  return speedMph * 1.60934;
}

function parseWindSpeedMph(speedText) {
  if (typeof speedText !== 'string') {
    return 0;
  }

  const matches = speedText.match(/\d+(?:\.\d+)?/g);
  if (!matches || !matches.length) {
    return 0;
  }

  const speeds = matches.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (!speeds.length) {
    return 0;
  }

  return average(speeds);
}

function compassToDegrees(direction) {
  const mapping = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
    E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
    W: 270, WNW: 292.5, NW: 315, NNW: 337.5
  };

  const normalized = String(direction || '').toUpperCase().replace(/\s+/g, '');
  return Number.isFinite(mapping[normalized]) ? mapping[normalized] : 0;
}

function selectDominantText(values) {
  if (!values.length) {
    return 'clear conditions';
  }

  const counts = new Map();
  let dominant = values[0];
  let highestCount = 0;

  for (const value of values) {
    const key = String(value || '').trim();
    if (!key) {
      continue;
    }

    const nextCount = (counts.get(key) || 0) + 1;
    counts.set(key, nextCount);
    if (nextCount > highestCount) {
      highestCount = nextCount;
      dominant = key;
    }
  }

  return dominant || 'clear conditions';
}

function buildNoaa12HourForecastSummary(hourlyPeriods) {
  const validPeriods = Array.isArray(hourlyPeriods) ? hourlyPeriods : [];
  if (!validPeriods.length) {
    throw new Error('NOAA hourly forecast data is unavailable.');
  }

  const now = Date.now();
  const startIndex = Math.max(0, validPeriods.findIndex((period) => Date.parse(period?.startTime || '') >= now));
  const selectedPeriods = validPeriods.slice(startIndex, startIndex + 12);
  if (!selectedPeriods.length) {
    throw new Error('NOAA did not provide a usable 12-hour forecast window.');
  }

  const temperatureF = selectedPeriods.map((period) => Number(period?.temperature)).filter((value) => Number.isFinite(value));
  if (!temperatureF.length) {
    throw new Error('NOAA temperature data is unavailable.');
  }

  const humidityValues = selectedPeriods
    .map((period) => Number(period?.relativeHumidity?.value))
    .filter((value) => Number.isFinite(value));
  const windSpeedMphValues = selectedPeriods
    .map((period) => parseWindSpeedMph(period?.windSpeed))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const windDirectionValues = selectedPeriods
    .map((period) => compassToDegrees(period?.windDirection))
    .filter((value) => Number.isFinite(value));
  const precipitationValues = selectedPeriods
    .map((period) => Number(period?.probabilityOfPrecipitation?.value))
    .filter((value) => Number.isFinite(value));
  const conditions = selectedPeriods.map((period) => String(period?.shortForecast || '').toLowerCase()).filter(Boolean);

  return {
    tempC: fToC(average(temperatureF)),
    feelsLikeC: fToC(average(temperatureF)),
    humidity: Math.round(humidityValues.length ? average(humidityValues) : 0),
    windSpeedKph: mphToKph(windSpeedMphValues.length ? average(windSpeedMphValues) : 0),
    windDirection: windDirectionValues.length ? average(windDirectionValues) : 0,
    weatherCode: 0,
    lowC: fToC(Math.min(...temperatureF)),
    highC: fToC(Math.max(...temperatureF)),
    precipChance: precipitationValues.length ? Math.max(...precipitationValues) : 0,
    visibilityKm: 10,
    conditionsSummary: selectDominantText(conditions)
  };
}

function buildNoaaDailyTemperatureSummary(hourlyPeriods) {
  const validPeriods = Array.isArray(hourlyPeriods) ? hourlyPeriods : [];
  if (!validPeriods.length) {
    return { dailyLowC: NaN, dailyHighC: NaN };
  }

  const firstPeriodDate = (validPeriods[0]?.startTime || '').split('T')[0];
  const dayPeriods = firstPeriodDate
    ? validPeriods.filter((period) => String(period?.startTime || '').startsWith(firstPeriodDate))
    : validPeriods.slice(0, 24);
  const sourcePeriods = dayPeriods.length ? dayPeriods : validPeriods.slice(0, 24);
  const tempsF = sourcePeriods.map((period) => Number(period?.temperature)).filter((value) => Number.isFinite(value));
  if (!tempsF.length) {
    return { dailyLowC: NaN, dailyHighC: NaN };
  }

  return {
    dailyLowC: fToC(Math.min(...tempsF)),
    dailyHighC: fToC(Math.max(...tempsF))
  };
}

async function geocodeCityState(location) {
  const query = encodeURIComponent(location.city);
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=10&language=en&format=json`);

  if (!response.ok) {
    throw new Error('Location lookup failed.');
  }

  const data = await response.json();
  const matches = data.results || [];

  const targetState = (location.state || '').toUpperCase();
  const fullStateName = US_STATES[targetState] || location.state || '';

  const exactMatch = matches.find((item) => {
    const admin = (item.admin1 || '').toLowerCase();
    const adminMatch = admin === targetState.toLowerCase() || (fullStateName && admin === fullStateName.toLowerCase());
    const nameMatch = (item.name || '').toLowerCase() === location.city.toLowerCase();
    return nameMatch && adminMatch;
  });

  const primary = exactMatch || matches.find((item) => item.name.toLowerCase() === location.city.toLowerCase()) || matches[0];

  if (!primary) {
    throw new Error('No matching city/state location was found.');
  }

  return {
    latitude: primary.latitude,
    longitude: primary.longitude,
    name: primary.name,
    admin1: primary.admin1,
    country: primary.country
  };
}

async function fetchNoaaWeatherForLocation(latitude, longitude, displayName) {
  const noaaHeaders = {
    Accept: 'application/geo+json'
  };
  const pointsResponse = await fetch(`https://api.weather.gov/points/${latitude},${longitude}`, { headers: noaaHeaders });
  if (!pointsResponse.ok) {
    throw new Error(`NOAA points lookup failed (${pointsResponse.status}).`);
  }

  const pointsData = await pointsResponse.json();
  const hourlyUrl = pointsData?.properties?.forecastHourly;
  if (!hourlyUrl) {
    throw new Error('NOAA did not return an hourly forecast endpoint.');
  }

  const hourlyResponse = await fetch(hourlyUrl, { headers: noaaHeaders });
  if (!hourlyResponse.ok) {
    throw new Error(`NOAA hourly forecast request failed (${hourlyResponse.status}).`);
  }

  const hourlyData = await hourlyResponse.json();
  const hourlyPeriods = Array.isArray(hourlyData?.properties?.periods) ? hourlyData.properties.periods : [];
  const forecastSummary = buildNoaa12HourForecastSummary(hourlyPeriods);
  const dailySummary = buildNoaaDailyTemperatureSummary(hourlyPeriods);
  const reportPeriod = getReportPeriodFromGenerationTime();
  const conditionsSummary = forecastSummary.conditionsSummary;

  return {
    location: displayName,
    tempC: forecastSummary.tempC,
    feelsLikeC: forecastSummary.feelsLikeC,
    humidity: forecastSummary.humidity,
    windSpeedKph: forecastSummary.windSpeedKph,
    windDirection: forecastSummary.windDirection,
    weatherCode: forecastSummary.weatherCode,
    lowC: forecastSummary.lowC,
    highC: forecastSummary.highC,
    dailyLowC: Number.isFinite(dailySummary.dailyLowC) ? dailySummary.dailyLowC : forecastSummary.lowC,
    dailyHighC: Number.isFinite(dailySummary.dailyHighC) ? dailySummary.dailyHighC : forecastSummary.highC,
    precipChance: forecastSummary.precipChance,
    visibilityKm: forecastSummary.visibilityKm,
    conditionsSummary,
    latitude,
    longitude,
    reportPeriod,
    reportPeriodLabel: getReportPeriodLabel(reportPeriod),
    source: 'NOAA',
    environment: getEnvironment(forecastSummary.tempC, forecastSummary.humidity, conditionsSummary, latitude, displayName)
  };
}

async function fetchOpenMeteoWeatherForLocation(latitude, longitude, displayName) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,visibility,precipitation&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,visibility,precipitation_probability&daily=temperature_2m_min,temperature_2m_max&timezone=auto&forecast_days=2`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Weather data request failed.');
  }

  const data = await response.json();
  const reportPeriod = getReportPeriodFromGenerationTime();
  const forecastSummary = build12HourForecastSummary(data);
  const dailySummary = buildDailyTemperatureSummary(data);
  const conditionsSummary = forecastSummary.conditionsSummary;

  return {
    location: displayName,
    tempC: forecastSummary.tempC,
    feelsLikeC: forecastSummary.feelsLikeC,
    humidity: forecastSummary.humidity,
    windSpeedKph: forecastSummary.windSpeedKph,
    windDirection: forecastSummary.windDirection,
    weatherCode: forecastSummary.weatherCode,
    lowC: forecastSummary.lowC,
    highC: forecastSummary.highC,
    dailyLowC: Number.isFinite(dailySummary.dailyLowC) ? dailySummary.dailyLowC : forecastSummary.lowC,
    dailyHighC: Number.isFinite(dailySummary.dailyHighC) ? dailySummary.dailyHighC : forecastSummary.highC,
    precipChance: forecastSummary.precipChance,
    visibilityKm: forecastSummary.visibilityKm,
    conditionsSummary,
    latitude,
    longitude,
    reportPeriod,
    reportPeriodLabel: getReportPeriodLabel(reportPeriod),
    source: 'Open-Meteo (fallback)',
    environment: getEnvironment(forecastSummary.tempC, forecastSummary.humidity, conditionsSummary, latitude, displayName)
  };
}

async function fetchWeatherForLocation(location) {
  let latitude;
  let longitude;
  let displayName = formatLocationLabel(location);

  if (location.type === 'coordinates') {
    latitude = location.lat;
    longitude = location.lon;
  } else {
    const geoLocation = await geocodeCityState(location);
    latitude = geoLocation.latitude;
    longitude = geoLocation.longitude;
    displayName = `${geoLocation.name}, ${geoLocation.admin1 || geoLocation.country || 'Location'}`;
  }

  let noaaError;
  try {
    return await fetchNoaaWeatherForLocation(latitude, longitude, displayName);
  } catch (error) {
    noaaError = error;
  }

  try {
    return await fetchOpenMeteoWeatherForLocation(latitude, longitude, displayName);
  } catch (fallbackError) {
    const noaaMessage = noaaError instanceof Error ? noaaError.message : 'Unknown NOAA error.';
    const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown fallback error.';
    throw new Error(`NOAA failed: ${noaaMessage} Open-Meteo fallback failed: ${fallbackMessage}`);
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const rawValue = locationInput.value.trim();

  if (!rawValue) {
    setStatus('Please enter a city/state or grid coordinate.', false);
    reportOutput.textContent = 'Enter a valid location to generate a report.';
    reportOutput.classList.remove('empty');
    return;
  }

  const location = normalizeLocation(rawValue);
  setStatus('Gathering current conditions...');
  reportOutput.textContent = 'Loading weather data...';
  reportOutput.classList.remove('empty');

  try {
    const weather = await fetchWeatherForLocation(location);
    lastWeather = weather;
    renderReport(weather);
    setStatus('Report generated successfully.');
  } catch (error) {
    lastWeather = null;
    reportOutput.classList.remove('noaa-view');
    setStatus('Location lookup failed. Please check the input and try again.', false);
    reportOutput.textContent = `Unable to generate a report for "${rawValue}". Try a format like "35.1,-117.9" or "Phoenix, AZ".`;
    reportOutput.classList.remove('empty');
  }
}

quickPickButtons.forEach((button) => {
  button.addEventListener('click', () => {
    locationInput.value = button.dataset.example;
    locationInput.focus();
  });
});

formatButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyReportFormat(button.dataset.format);
  });
});

applyReportFormat(reportFormat);

form.addEventListener('submit', handleSubmit);
