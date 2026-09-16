import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNoaaForecastNarrative, formatLocalTimestamp, generateNoaaReport, generateWeatherNarrative, getEnvironment, getReportPeriodForTimeZone, normalizeLocation, windRangeText } from '../src/report-generator.js';

test('generateWeatherNarrative reports only supplied forecast facts', () => {
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
    conditionsSummary: 'clear sky',
    environment: 'desert'
  };

  const narrative = generateWeatherNarrative(weather);

  assert.match(narrative, /clear sky during the upcoming 12-hour period/i);
  assert.match(narrative, /68°F to 106°F, with an average near 102°F/i);
  assert.match(narrative, /highest forecast chance of precipitation is 0%/i);
  assert.match(narrative, /from the E at an average of 14 mph/i);
  assert.doesNotMatch(narrative, /live regional sensor|excellent|patrol operations/i);
});

test('generateWeatherNarrative reports humid forecast data without assumptions', () => {
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

  assert.match(narrative, /forecast relative humidity averages 62%/i);
  assert.doesNotMatch(narrative, /desert/i);
  assert.match(narrative, /77°F to 91°F, with an average near 88°F/i);
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

test('formatLocalTimestamp uses 24-hour military time in the weather location time zone', () => {
  const phoenixTime = formatLocalTimestamp('2026-09-16T12:30:45.000Z', 'America/Phoenix');
  const newYorkTime = formatLocalTimestamp('2026-09-16T12:30:45.000Z', 'America/New_York');
  const midnight = formatLocalTimestamp('2026-09-16T07:05:09.000Z', 'America/Phoenix');

  assert.match(phoenixTime, /Sep 16, 2026, 05:30:45 (MST|GMT-7)/);
  assert.match(newYorkTime, /Sep 16, 2026, 08:30:45 EDT/);
  assert.match(midnight, /Sep 16, 2026, 00:05:09 (MST|GMT-7)/);
  assert.doesNotMatch(`${phoenixTime} ${newYorkTime} ${midnight}`, /\b(?:AM|PM)\b/);
});

test('getReportPeriodForTimeZone applies local 4:30 AM and 4:30 PM boundaries', () => {
  const timeZone = 'America/Phoenix';

  assert.equal(getReportPeriodForTimeZone('2026-09-16T11:29:00.000Z', timeZone), 'night');
  assert.equal(getReportPeriodForTimeZone('2026-09-16T11:30:00.000Z', timeZone), 'day');
  assert.equal(getReportPeriodForTimeZone('2026-09-16T23:29:00.000Z', timeZone), 'day');
  assert.equal(getReportPeriodForTimeZone('2026-09-16T23:30:00.000Z', timeZone), 'night');
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

  assert.match(narrative, /daytime 12-hour period/i);
  assert.match(narrative, /temperatures are forecast to range from/i);
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

  assert.match(narrative, /nighttime 12-hour period/i);
  assert.match(narrative, /temperatures are forecast to range from/i);
  assert.match(narrative, /forecast relative humidity averages 22%/i);
});

test('generateWeatherNarrative uses NOAA forecast text verbatim when available', () => {
  const narrative = generateWeatherNarrative({
    forecastNarrative: 'Tonight: Showers likely. Chance of precipitation is 70%.',
    tempC: 35,
    lowC: 20,
    highC: 40,
    conditionsSummary: 'clear sky'
  });

  assert.equal(narrative, 'Tonight: Showers likely. Chance of precipitation is 70%.');
});

test('buildNoaaForecastNarrative includes official periods overlapping the next 12 hours', () => {
  const periods = [
    {
      name: 'Overnight',
      startTime: '2026-09-16T04:00:00-07:00',
      endTime: '2026-09-16T06:00:00-07:00',
      detailedForecast: 'Showers and thunderstorms likely. Chance of precipitation is 60%.'
    },
    {
      name: 'Wednesday',
      startTime: '2026-09-16T06:00:00-07:00',
      endTime: '2026-09-16T18:00:00-07:00',
      detailedForecast: 'Showers and thunderstorms. High near 88.'
    },
    {
      name: 'Wednesday Night',
      startTime: '2026-09-16T18:00:00-07:00',
      endTime: '2026-09-17T06:00:00-07:00',
      detailedForecast: 'A chance of showers.'
    }
  ];

  const narrative = buildNoaaForecastNarrative(periods, new Date('2026-09-16T05:00:00-07:00'));

  assert.equal(
    narrative,
    'Overnight: Showers and thunderstorms likely. Chance of precipitation is 60%. ' +
      'Wednesday: Showers and thunderstorms. High near 88.'
  );
  assert.doesNotMatch(narrative, /[\r\n]/);
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
