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
  const tempF = Math.round(cToF(weather.tempC));
  const highF = Math.round(cToF(weather.highC));
  const lowF = Math.round(cToF(weather.lowC));
  const humidity = weather.humidity ?? 0;
  const windDirection = getWindDirectionLabel(weather.windDirection ?? 0);
  const environment = weather.environment || getEnvironment(weather.tempC, humidity, weather.conditionsSummary || 'clear', weather.latitude, weather.location);
  const shiftLabel = weather.reportPeriod === 'day' ? 'daytime' : weather.reportPeriod === 'night' ? 'nighttime' : 'upcoming';
  const periodTemperatureText = 'Temperatures during this shit is forecasted to range from ' + lowF + '°F to ' + highF + '°F. ';

  let body = '';

  if (environment === 'desert') {
    body = 'Conditions are expected to remain clear and dry throughout the ' + shiftLabel + ' shift, with no precipitation anticipated. ' +
      'Current ambient air temperature at the start of the shift is ' + tempF + '°F, based on live regional sensor readings. ' +
      periodTemperatureText +
      'Winds remain steady from the ' + windDirection + ', averaging ' + windRangeText(weather.windSpeedKph) + ' with occasional lighter periods. ' +
      'Humidity stays between ' + formatHumidityRange(humidity - 8, humidity + 6) + '. ' +
      'Visibility remains excellent for the duration, with no fog, airborne obstructions, or cloud cover affecting patrol operations.';
  }

  if (environment === 'humid') {
    body = 'Conditions are expected to remain warm and humid throughout the ' + shiftLabel + ' shift, with no significant precipitation anticipated. ' +
      'Current ambient air temperature at the start of the shift is ' + tempF + '°F, based on live regional sensor readings. ' +
      periodTemperatureText +
      'Winds remain steady from the ' + windDirection + ', averaging ' + windRangeText(weather.windSpeedKph) + ' with occasional lighter periods. ' +
      'Humidity stays between ' + formatHumidityRange(Math.max(40, humidity - 8), humidity + 12) + '. ' +
      'Visibility remains excellent for the duration, with no fog, airborne obstructions, or cloud cover affecting patrol operations.';
  }

  if (environment === 'wet') {
    body = 'Conditions are expected to remain unsettled throughout the ' + shiftLabel + ' shift, with periodic precipitation likely. ' +
      'Current ambient air temperature at the start of the shift is ' + tempF + '°F, based on live regional sensor readings. ' +
      periodTemperatureText +
      'Winds remain steady from the ' + windDirection + ', averaging ' + windRangeText(weather.windSpeedKph) + ' with occasional lighter periods. ' +
      'Humidity stays between ' + formatHumidityRange(humidity - 10, humidity + 12) + '. ' +
      'Visibility may be reduced by cloud cover or light precipitation during the shift.';
  }

  if (environment === 'cold') {
    body = 'Conditions are expected to remain cold and stable throughout the ' + shiftLabel + ' shift, with no significant precipitation anticipated. ' +
      'Current ambient air temperature at the start of the shift is ' + tempF + '°F, based on live regional sensor readings. ' +
      periodTemperatureText +
      'Winds remain steady from the ' + windDirection + ', averaging ' + windRangeText(weather.windSpeedKph) + ' with occasional lighter periods. ' +
      'Humidity stays between ' + formatHumidityRange(Math.max(30, humidity - 5), humidity + 10) + '. ' +
      'Visibility remains acceptable for the duration, with no major obstructions affecting patrol operations.';
  }

  if (environment === 'general') {
    body = 'Conditions are expected to remain generally stable throughout the ' + shiftLabel + ' shift, with no significant weather disruptions anticipated. ' +
      'Current ambient air temperature at the start of the shift is ' + tempF + '°F, based on live regional sensor readings. ' +
      periodTemperatureText +
      'Winds remain steady from the ' + windDirection + ', averaging ' + windRangeText(weather.windSpeedKph) + ' with occasional lighter periods. ' +
      'Humidity stays between ' + formatHumidityRange(Math.max(25, humidity - 10), humidity + 12) + '. ' +
      'Visibility remains good for the duration, with no major obstructions affecting patrol operations.';
  }

  return body;
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

function formatHumidityRange(lowHumidity, highHumidity) {
  const low = Math.max(0, Math.round(Math.min(lowHumidity, highHumidity)));
  const high = Math.min(100, Math.round(Math.max(lowHumidity, highHumidity)));
  return low + '-' + high + '%';
}

export { generateNoaaReport, generateWeatherNarrative, getEnvironment, normalizeLocation, windRangeText };
