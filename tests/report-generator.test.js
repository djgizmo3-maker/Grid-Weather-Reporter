import test from 'node:test';
import assert from 'node:assert/strict';

import { generateWeatherNarrative, getEnvironment, normalizeLocation } from '../src/report-generator.js';

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
  assert.match(narrative, /clear and dry throughout the shift/i);
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
