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
  if (mph <= 10) return '9–17 mph';
  if (mph <= 20) return '9–17 mph';
  if (mph <= 30) return '18–24 mph';
  return '20–30 mph';
}

function generateWeatherNarrative(weather) {
  const tempF = Math.round(cToF(weather.tempC));
  const lowF = Math.round(cToF(weather.lowC));
  const humidity = weather.humidity ?? 0;
  const windDirection = getWindDirectionLabel(weather.windDirection ?? 0);
  const environment = weather.environment || getEnvironment(weather.tempC, humidity, weather.conditionsSummary || 'clear', weather.latitude, weather.location);

  let body = '';

  if (environment === 'desert') {
    body = 'Conditions are expected to remain clear and dry throughout the shift, with no precipitation anticipated. ' +
      'Current ambient air temperature at the start of the shift is ' + tempF + '°F, based on live regional sensor readings. ' +
      'Overnight lows are expected to fall into the ' + formatTemperatureRange(lowF) + ' range. ' +
      'Winds remain steady from the ' + windDirection + ', averaging ' + windRangeText(weather.windSpeedKph) + ' with occasional lighter periods. ' +
      'Humidity stays between ' + (humidity - 8) + '-' + (humidity + 6) + '%. ' +
      'Visibility remains excellent for the full duration, with no fog, airborne obstructions, or cloud cover affecting patrol operations.';
  }

  if (environment === 'humid') {
    const lowRange = Math.max(0, lowF - 4) + '-' + (lowF + 5) + '°F';
    body = 'Conditions are expected to remain warm and humid throughout the shift, with no significant precipitation anticipated. ' +
      'Current ambient air temperature at the start of the shift is ' + tempF + '°F, based on live regional sensor readings. ' +
      'Overnight lows are expected to fall into the ' + lowRange + ' range. ' +
      'Winds remain steady from the ' + windDirection + ', averaging ' + windRangeText(weather.windSpeedKph) + ' with occasional lighter periods. ' +
      'Humidity stays between ' + Math.max(40, humidity - 8) + '-' + (humidity + 12) + '%. ' +
      'Visibility remains excellent for the full duration, with no fog, airborne obstructions, or cloud cover affecting patrol operations.';
  }

  if (environment === 'wet') {
    body = 'Conditions are expected to remain unsettled throughout the shift, with periodic precipitation likely. ' +
      'Current ambient air temperature at the start of the shift is ' + tempF + '°F, based on live regional sensor readings. ' +
      'Overnight lows are expected to fall into the ' + formatTemperatureRange(lowF) + ' range. ' +
      'Winds remain steady from the ' + windDirection + ', averaging ' + windRangeText(weather.windSpeedKph) + ' with occasional lighter periods. ' +
      'Humidity stays between ' + (humidity - 10) + '-' + (humidity + 12) + '%. ' +
      'Visibility may be reduced by cloud cover or light precipitation during the shift.';
  }

  if (environment === 'cold') {
    body = 'Conditions are expected to remain cold and stable throughout the shift, with no significant precipitation anticipated. ' +
      'Current ambient air temperature at the start of the shift is ' + tempF + '°F, based on live regional sensor readings. ' +
      'Overnight lows are expected to fall into the ' + formatTemperatureRange(lowF) + ' range. ' +
      'Winds remain steady from the ' + windDirection + ', averaging ' + windRangeText(weather.windSpeedKph) + ' with occasional lighter periods. ' +
      'Humidity stays between ' + Math.max(30, humidity - 5) + '-' + (humidity + 10) + '%. ' +
      'Visibility remains acceptable for the full duration, with no major obstructions affecting patrol operations.';
  }

  if (environment === 'general') {
    body = 'Conditions are expected to remain generally stable throughout the shift, with no significant weather disruptions anticipated. ' +
      'Current ambient air temperature at the start of the shift is ' + tempF + '°F, based on live regional sensor readings. ' +
      'Overnight lows are expected to fall into the ' + formatTemperatureRange(lowF) + ' range. ' +
      'Winds remain steady from the ' + windDirection + ', averaging ' + windRangeText(weather.windSpeedKph) + ' with occasional lighter periods. ' +
      'Humidity stays between ' + Math.max(25, humidity - 10) + '-' + (humidity + 12) + '%. ' +
      'Visibility remains good for the full duration, with no major obstructions affecting patrol operations.';
  }

  return body;
}

function formatTemperatureRange(lowF) {
  const lowerBound = lowF - 3;
  const upperBound = lowF + 3;
  return lowerBound + '-' + upperBound + '°F';
}

export { generateWeatherNarrative, getEnvironment, normalizeLocation };
