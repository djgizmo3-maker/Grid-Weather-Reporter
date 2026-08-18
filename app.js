import { generateWeatherNarrative, normalizeLocation } from './src/report-generator.js';

const form = document.querySelector('#weather-form');
const locationInput = document.querySelector('#location-input');
const reportOutput = document.querySelector('#report-output');
const statusText = document.querySelector('#status-text');
const quickPickButtons = document.querySelectorAll('.chip');
const themeToggle = document.querySelector('#theme-toggle');

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

function detectEnvironment(latitude, temperatureC, humidity, conditionsSummary) {
  const normalized = (conditionsSummary || '').toLowerCase();

  if (normalized.includes('rain') || normalized.includes('storm') || normalized.includes('snow')) {
    return 'wet';
  }

  if (typeof latitude === 'number' && latitude >= 25 && latitude <= 40 && humidity >= 45) {
    return 'humid';
  }

  if (temperatureC >= 30 && humidity <= 35) {
    return 'desert';
  }

  if (humidity >= 55 && temperatureC >= 24) {
    return 'humid';
  }

  if (temperatureC <= 5) {
    return 'cold';
  }

  return 'general';
}

async function geocodeCityState(location) {
  const query = encodeURIComponent(location.city);
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=10&language=en&format=json`);

  if (!response.ok) {
    throw new Error('Location lookup failed.');
  }

  const data = await response.json();
  const matches = data.results || [];

  const exactMatch = matches.find((item) => {
    const adminMatch = (item.admin1 || '').toLowerCase() === (location.state || '').toLowerCase();
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

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,visibility&daily=temperature_2m_min,temperature_2m_max&timezone=auto&forecast_days=1`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Weather data request failed.');
  }

  const data = await response.json();
  const current = data.current || {};
  const daily = data.daily || {};

  const temperature = Number(current.temperature_2m ?? 0);
  const low = Number((daily.temperature_2m_min || [temperature])[0] ?? temperature);
  const high = Number((daily.temperature_2m_max || [temperature])[0] ?? temperature);
  const humidity = Number(current.relative_humidity_2m ?? 0);
  const windSpeedKph = Number(current.wind_speed_10m ?? 0);
  const windDirection = Number(current.wind_direction_10m ?? 0);
  const visibilityKm = Number((current.visibility ?? 0) / 1000);
  const rainChance = Number(current.precipitation ?? 0);

  return {
    location: displayName,
    tempC: temperature,
    feelsLikeC: Number(current.apparent_temperature ?? temperature),
    humidity,
    windSpeedKph,
    windDirection,
    weatherCode: Number(current.weather_code ?? 0),
    lowC: low,
    highC: high,
    precipChance: rainChance > 0 ? 25 : 0,
    visibilityKm,
    conditionsSummary: mapWeatherCode(Number(current.weather_code ?? 0)),
    latitude,
    longitude,
    environment: detectEnvironment(latitude, temperature, humidity, mapWeatherCode(Number(current.weather_code ?? 0)))
  };
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
    const narrative = generateWeatherNarrative(weather);
    const heading = `Current Weather Condition Report\nLocation: ${weather.location}\n\n`;
    updateReport(`${heading}${narrative}`);
    setStatus('Report generated successfully.');
  } catch (error) {
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

form.addEventListener('submit', handleSubmit);
