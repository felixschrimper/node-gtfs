/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  getCalendars,
} from '../../index.js';

describe('getCalendars():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return empty array if no calendars', async () => {
    const serviceId = 'fake-service-id';

    const results = await getCalendars({
      service_id: serviceId,
    });
    should.exists(results);
    results.should.have.length(0);
  });

  it('should return expected calendars by day', async () => {
    const results = await getCalendars({
      sunday: 1,
    });

    const expectedResult = {
      service_id: 'CT-16APR-Caltrain-Sunday-02',
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
      sunday: 1,
      start_date: 20140323,
      end_date: 20190331,
    };

    should.exist(results);
    results.length.should.equal(1);
    expectedResult.should.match(results[0]);
  });

  it('should return expected calendars by array of service_ids', async () => {
    const results = await getCalendars({
      service_id: [
        'CT-16APR-Caltrain-Saturday-02',
        'CT-16APR-Caltrain-Sunday-02',
      ],
    });

    const expectedResults = [
      {
        service_id: 'CT-16APR-Caltrain-Saturday-02',
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 1,
        sunday: 0,
        start_date: 20140329,
        end_date: 20190331,
      },
      {
        service_id: 'CT-16APR-Caltrain-Sunday-02',
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 1,
        start_date: 20140323,
        end_date: 20190331,
      },
    ];

    should.exist(results);
    results.length.should.equal(2);

    for (const result of results) {
      expectedResults.should.matchAny(result);
    }
  });
});
