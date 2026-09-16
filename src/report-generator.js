function normalizeLocation(input) {
  const value = (input || '').trim();

  const coordinateMatch = value.match(/^([-+]?\d{1,3}(?:\.\d+)?),\s*([-+]?\d{1,3}(?:\.\d+)?)$/);
  if (coordinateMatch) {
    const lat = Number(coordinateMatch[1]);
    const lon = Number(coordinateMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { type: 'coordinates', lat, lon };
    }
  }

  const cityStateMatch = value.match(/^([^,]+),\s*([A-Za-z]{2,})$/);
  if (cityStateMatch) {
    return {
      type: 'city-state',
      city: cityStateMatch[1].trim(),
      state: cityStateMatch[2].trim().toUpperCase()
    };
  }

  return { type: 'city-state', city: value, state: '' };
}

function cToF(celsius) {
  return (celsius * 9) / 5 + 32;
}

function formatLocalTimestamp(timestamp, timeZone) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('A valid timestamp is required.');
  }
  if (typeof timeZone !== 'string' || !timeZone.trim()) {
    throw new Error('A valid location time zone is required.');
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
    hourCycle: 'h23'
  }).format(date);
}

function getReportPeriodForTimeZone(timestamp, timeZone) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('A valid timestamp is required.');
  }
  if (typeof timeZone !== 'string' || !timeZone.trim()) {
    throw new Error('A valid location time zone is required.');
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error('Unable to determine the local report time.');
  }

  const minutesSinceMidnight = (hour * 60) + minute;
  return minutesSinceMidnight >= (4 * 60 + 30) && minutesSinceMidnight < (16 * 60 + 30)
    ? 'day'
    : 'night';
}

function getWindDirectionLabel(degrees) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round((((degrees % 360) + 360) % 360) / 45) % directions.length;
  return directions[index];
}

function getEnvironment(tempC, humidity, conditionsSummary, latitude = null, locationName = '') {
  const normalized = (conditionsSummary || '').toLowerCase();
  const location = (locationName || '').toLowerCase();

  if (normalized.includes('rain') || normalized.includes('storm') || normalized.includes('snow')) {
    return 'wet';
  }

  const coastalSoutheast =
    typeof latitude === 'number' &&
    latitude >= 24 &&
    latitude <= 38 &&
    /(sc|ga|nc|fl|va|md|de|nj|ny|ct|ma|ri|nh|me)/.test(location) ||
    /(?:yemassee|charleston|savannah|jacksonville|myrtle beach|beaufort|hilton head)/.test(location);

  if (coastalSoutheast) {
    return 'humid';
  }

  if (typeof latitude === 'number' && latitude >= 25 && latitude <= 40 && humidity >= 45) {
    return 'humid';
  }

  if (tempC >= 30 && humidity <= 35) {
    return 'desert';
  }

  if (humidity >= 55 && tempC >= 24) {
    return 'humid';
  }

  if (tempC <= 5) {
    return 'cold';
  }

  return 'general';
}

function windRangeText(speedKph) {
  const mph = Math.round(speedKph * 0.621371);
  if (mph <= 10) return '3–8 mph';
  if (mph <= 20) return '9–17 mph';
  if (mph <= 30) return '18–24 mph';
  return '20–30 mph';
}

function generateWeatherNarrative(weather) {
  if (typeof weather.forecastNarrative === 'string' && weather.forecastNarrative.trim()) {
    return weather.forecastNarrative.trim();
  }

  const tempF = Math.round(cToF(weather.tempC));
  const highF = Math.round(cToF(weather.highC));
  const lowF = Math.round(cToF(weather.lowC));
  const humidity = Number.isFinite(weather.humidity) ? Math.round(weather.humidity) : null;
  const windMph = Number.isFinite(weather.windSpeedKph) ? Math.round(weather.windSpeedKph * 0.621371) : null;
  const windDirection = getWindDirectionLabel(weather.windDirection ?? 0);
  const shiftLabel = weather.reportPeriod === 'day' ? 'daytime' : weather.reportPeriod === 'night' ? 'nighttime' : 'upcoming';
  const conditions = String(weather.conditionsSummary || 'weather conditions unavailable').trim();
  const sentences = [
    `The forecast calls for ${conditions} during the ${shiftLabel} 12-hour period.`,
    `Temperatures are forecast to range from ${lowF}°F to ${highF}°F, with an average near ${tempF}°F.`
  ];

  if (Number.isFinite(weather.precipChance)) {
    sentences.push(`The highest forecast chance of precipitation is ${Math.round(weather.precipChance)}%.`);
  }

  if (windMph !== null) {
    sentences.push(windMph <= 0
      ? 'Winds are forecast to be calm or light and variable.'
      : `Winds are forecast from the ${windDirection} at an average of ${windMph} mph.`);
  }

  if (humidity !== null) {
    sentences.push(`Forecast relative humidity averages ${humidity}%.`);
  }

  if (Number.isFinite(weather.visibilityKm)) {
    sentences.push(`Forecast visibility averages ${(weather.visibilityKm * 0.621371).toFixed(1)} miles.`);
  }

  return sentences.join(' ');
}

function buildNoaaForecastNarrative(periods, generatedAt = new Date()) {
  const startTime = generatedAt instanceof Date ? generatedAt.getTime() : new Date(generatedAt).getTime();
  if (!Number.isFinite(startTime)) {
    throw new Error('A valid report generation time is required.');
  }

  const endTime = startTime + (12 * 60 * 60 * 1000);
  const overlappingPeriods = (Array.isArray(periods) ? periods : []).filter((period) => {
    const periodStart = Date.parse(period?.startTime || '');
    const periodEnd = Date.parse(period?.endTime || '');
    return Number.isFinite(periodStart) &&
      Number.isFinite(periodEnd) &&
      periodEnd > startTime &&
      periodStart < endTime &&
      typeof period?.detailedForecast === 'string' &&
      period.detailedForecast.trim();
  });

  if (!overlappingPeriods.length) {
    throw new Error('NOAA detailed forecast text is unavailable for the next 12 hours.');
  }

  return overlappingPeriods
    .map((period) => `${period.name || 'Forecast period'}: ${period.detailedForecast.trim()}`)
    .join(' ');
}

function getDetailedWindDirectionLabel(degrees) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % directions.length;
  return directions[index];
}

function getSkyCondition(conditionsSummary) {
  const normalized = (conditionsSummary || '').toLowerCase();

  if (normalized.includes('thunder')) return 'Thunderstorms';
  if (normalized.includes('snow') || normalized.includes('sleet')) return 'Snow';
  if (normalized.includes('freezing')) return 'Freezing precipitation';
  if (normalized.includes('rain') || normalized.includes('shower')) return 'Rain';
  if (normalized.includes('drizzle')) return 'Drizzle';
  if (normalized.includes('fog')) return 'Fog';
  if (normalized.includes('overcast')) return 'Overcast';
  if (normalized.includes('partly') || normalized.includes('mostly cloudy')) return 'Partly cloudy';
  if (normalized.includes('cloud')) return 'Cloudy';
  if (normalized.includes('clear') || normalized.includes('sunny')) return 'Clear';

  return conditionsSummary ? conditionsSummary.charAt(0).toUpperCase() + conditionsSummary.slice(1) : 'Clear';
}

function formatNoaaRow(label, value) {
  const paddedLabel = (label + ' ').padEnd(20, '.');
  return paddedLabel + ' ' + value;
}

function generateNoaaReport(weather) {
  const tempF = Math.round(cToF(weather.tempC));
  const highF = Math.round(cToF(weather.highC));
  const lowF = Math.round(cToF(weather.lowC));
  const feelsLikeF = Number.isFinite(weather.feelsLikeC) ? Math.round(cToF(weather.feelsLikeC)) : tempF;
  const humidity = Math.round(weather.humidity ?? 0);
  const windMph = Math.round((weather.windSpeedKph ?? 0) * 0.621371);
  const windDirection = getDetailedWindDirectionLabel(weather.windDirection ?? 0);
  const precipChance = Math.round(weather.precipChance ?? 0);
  const visibilityMiles = Number.isFinite(weather.visibilityKm) ? weather.visibilityKm * 0.621371 : null;
  const shiftLabel = weather.reportPeriod === 'day' ? 'Daytime' : weather.reportPeriod === 'night' ? 'Nighttime' : 'Upcoming';

  const rows = [
    formatNoaaRow('Forecast Period', shiftLabel + ', 12 hr'),
    formatNoaaRow('Sky/Weather', getSkyCondition(weather.conditionsSummary)),
    formatNoaaRow('Temperature', tempF + '\u00b0F'),
    formatNoaaRow('Apparent Temp', feelsLikeF + '\u00b0F'),
    formatNoaaRow('Max Temperature', highF + '\u00b0F'),
    formatNoaaRow('Min Temperature', lowF + '\u00b0F'),
    formatNoaaRow('Wind', windMph <= 0 ? 'Light and variable' : windDirection + ' at ' + windMph + ' mph'),
    formatNoaaRow('Relative Humidity', humidity + '%'),
    formatNoaaRow('Chance of Precip', precipChance + '%'),
    formatNoaaRow('Visibility', visibilityMiles === null ? 'Not available' : visibilityMiles.toFixed(1) + ' mi')
  ];

  return rows.join('\n');
}

export { buildNoaaForecastNarrative, formatLocalTimestamp, generateNoaaReport, generateWeatherNarrative, getEnvironment, getReportPeriodForTimeZone, normalizeLocation, windRangeText };
