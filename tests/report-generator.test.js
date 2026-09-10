import test from 'node:test';
import assert from 'node:assert/strict';

import { generateNoaaReport, generateWeatherNarrative, getEnvironment, normalizeLocation, windRangeText } from '../src/report-generator.js';

test('generateWeatherNarrative uses desert wording for hot dry conditions', () => {
  const weather = {
    location: 'Las Vegas, NV',
    tempC: 39,
    feelsLikeC: 38,
    humidity: 20,
    windSpeedKph: 23,
    windDirection: 70,
    weatherCode: 0,
    lowC: 20,
    highC: 41,
    precipChance: 0,
    visibilityKm: 10,
    environment: 'desert'
  };

  const narrative = generateWeatherNarrative(weather);

  assert.doesNotMatch(narrative, /consistent with typical desert nighttime cooling/i);
  assert.match(narrative, /clear and dry throughout the .*shift/i);
  assert.match(narrative, /102\u00b0F/i);
  assert.match(narrative, /9[-–]17 mph|18[-–]24 mph/i);
});

test('generateWeatherNarrative adapts to humid coastal conditions', () => {
  const weather = {
    location: 'Yemassee, SC',
    tempC: 31,
    feelsLikeC: 34,
    humidity: 62,
    windSpeedKph: 18,
    windDirection: 110,
    weatherCode: 0,
    lowC: 25,
    highC: 33,
    precipChance: 0,
    visibilityKm: 10,
    environment: 'humid'
  };

  const narrative = generateWeatherNarrative(weather);

  assert.match(narrative, /warm and humid|humid/i);
  assert.doesNotMatch(narrative, /desert/i);
  assert.match(narrative, /87\u00b0F|88\u00b0F|89\u00b0F/i);
});

test('Yemassee, SC is treated as coastal humid even with a hot dry reading', () => {
  const weather = {
    location: 'Yemassee, SC',
    tempC: 31,
    humidity: 28,
    latitude: 32.7,
    longitude: -80.8,
    conditionsSummary: 'clear sky'
  };

  const environment = getEnvironment(weather.tempC, weather.humidity, weather.conditionsSummary, weather.latitude, weather.location);
  assert.equal(environment, 'humid');
});

test('normalizeLocation accepts grid coordinates and city-state strings', () => {
  assert.deepEqual(normalizeLocation('35.1,-117.9'), { type: 'coordinates', lat: 35.1, lon: -117.9 });
  assert.deepEqual(normalizeLocation('Phoenix, AZ'), { type: 'city-state', city: 'Phoenix', state: 'AZ' });
  assert.deepEqual(normalizeLocation('  Denver , CO '), { type: 'city-state', city: 'Denver', state: 'CO' });
});

test('windRangeText accurately formats light and moderate wind speeds', () => {
  assert.equal(windRangeText(8), '3–8 mph');
  assert.equal(windRangeText(25), '9–17 mph');
  assert.equal(windRangeText(40), '18–24 mph');
  assert.equal(windRangeText(50), '20–30 mph');
});

test('generateWeatherNarrative marks daytime reports as next 12-hour conditions', () => {
  const weather = {
    location: 'Phoenix, AZ',
    tempC: 34,
    humidity: 20,
    windSpeedKph: 18,
    windDirection: 90,
    lowC: 28,
    highC: 39,
    environment: 'desert',
    reportPeriod: 'day'
  };

  const narrative = generateWeatherNarrative(weather);

  assert.match(narrative, /daytime shift/i);
  assert.match(narrative, /temperatures during this shit is forecasted to range from/i);
});

test('generateWeatherNarrative marks nighttime reports as 12-hour conditions', () => {
  const weather = {
    location: 'Phoenix, AZ',
    tempC: 28,
    humidity: 22,
    windSpeedKph: 14,
    windDirection: 120,
    lowC: 22,
    highC: 31,
    environment: 'desert',
    reportPeriod: 'night'
  };

  const narrative = generateWeatherNarrative(weather);

  assert.match(narrative, /nighttime shift/i);
  assert.match(narrative, /temperatures during this shit is forecasted to range from/i);
  assert.match(narrative, /humidity stays between 14-28%/i);
});

test('generateNoaaReport emits labeled NOAA-style data rows', () => {
  const weather = {
    location: 'Phoenix, AZ',
    tempC: 34,
    feelsLikeC: 36,
    humidity: 20,
    windSpeedKph: 16,
    windDirection: 90,
    lowC: 28,
    highC: 39,
    precipChance: 10,
    visibilityKm: 16.09,
    conditionsSummary: 'clear sky',
    reportPeriod: 'day'
  };

  const report = generateNoaaReport(weather);

  assert.match(report, /Forecast Period \.+ Daytime, 12 hr/);
  assert.match(report, /Sky\/Weather \.+ Clear/);
  assert.match(report, /Temperature \.+ 93\u00b0F/);
  assert.match(report, /Apparent Temp \.+ 97\u00b0F/);
  assert.match(report, /Max Temperature \.+ 102\u00b0F/);
  assert.match(report, /Min Temperature \.+ 82\u00b0F/);
  assert.match(report, /Wind \.+ E at 10 mph/);
  assert.match(report, /Relative Humidity \.+ 20%/);
  assert.match(report, /Chance of Precip \.+ 10%/);
  assert.match(report, /Visibility \.+ 10\.0 mi/);
});

test('generateNoaaReport reports calm wind and unavailable visibility gracefully', () => {
  const report = generateNoaaReport({
    tempC: 5,
    humidity: 80,
    windSpeedKph: 0,
    windDirection: 0,
    lowC: 2,
    highC: 8,
    conditionsSummary: 'light rain',
    reportPeriod: 'night'
  });

  assert.match(report, /Wind \.+ Light and variable/);
  assert.match(report, /Sky\/Weather \.+ Rain/);
  assert.match(report, /Chance of Precip \.+ 0%/);
  assert.match(report, /Visibility \.+ Not available/);
});
