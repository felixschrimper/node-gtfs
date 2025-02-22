import path from 'node:path';
import { writeFile } from 'node:fs/promises';

import { without, compact } from 'lodash-es';
import pluralize from 'pluralize';
import sqlString from 'sqlstring-sqlite';
import mapSeries from 'promise-map-series';
import untildify from 'untildify';

import models from '../models/models.js';
import { openDb } from './db.js';
import { prepDirectory, generateFolderName } from './file-utils.js';
import { log as _log, logWarning as _logWarning } from './log-utils.js';
import { setDefaultConfig } from './utils.js';
import { parseAsync } from "json2csv";

const exportGtfs = async (initialConfig) => {
  const config = setDefaultConfig(initialConfig);
  const log = _log(config);
  const logWarning = _logWarning(config);
  const db = await openDb(config);

  // Get agency name for export folder from first line of agency.txt
  const agencies = await db.all('SELECT agency_name FROM agency;').catch(() => {
    if (config.sqlitePath === ':memory:') {
      throw new Error(
        'No agencies found in SQLite. You are using an in-memory database - if running this from command line be sure to specify a value for `sqlitePath` in config.json other than ":memory:".'
      );
    }

    throw new Error(
      'No agencies found in SQLite. Be sure to first import data into SQLite using `gtfs-import` or `importGtfs(config);`'
    );
  });

  const agencyCount = agencies.length;
  if (agencyCount === 0) {
    throw new Error(
      'No agencies found in SQLite. Be sure to first import data into SQLite using `gtfs-import` or `importGtfs(config);`'
    );
  } else if (agencyCount > 1) {
    logWarning(
      'More than one agency is defined in config.json. Export will merge all into one GTFS file.'
    );
  }

  log(
    `Starting GTFS export for ${pluralize(
      'agency',
      agencyCount,
      true
    )} using SQLite database at ${config.sqlitePath}`
  );

  const folderName = generateFolderName(agencies[0].agency_name);
  const defaultExportPath = path.join(process.cwd(), 'gtfs-export', folderName);
  const exportPath = untildify(config.exportPath || defaultExportPath);

  await prepDirectory(exportPath);

  // Loop through each GTFS file
  const exportedFiles = await mapSeries(models, async (model) => {
    const filepath = path.join(exportPath, `${model.filenameBase}.txt`);
    const tableName = sqlString.escapeId(model.filenameBase);
    const lines = await db.all(`SELECT * FROM ${tableName};`);

    if (!lines || lines.length === 0) {
      if (!model.nonstandard) {
        log(`Skipping (no data) - ${model.filenameBase}.txt\r`);
      }

      return;
    }

    const excludeColumns = [
      'id',
      'arrival_timestamp',
      'departure_timestamp',
      'start_timestamp',
      'end_timestamp',
      'service_arrival_timestamp',
      'service_departure_timestamp',
      'boarding_timestamp',
      'alighting_timestamp',
      'ridership_start_timestamp',
      'ridership_end_timestamp',
    ];

    const columns = without(
      model.schema.map((column) => column.name),
      ...excludeColumns
    );

    var csv = ""

    await parseAsync(lines, columns)
    .then(xxx => csv = xxx)
    .catch(err => console.error(err));

    await writeFile(filepath, csv);

    log(`Exporting - ${model.filenameBase}.txt\r`);

    return `${model.filenameBase}.txt`;
  });

  if (compact(exportedFiles).length === 0) {
    log('No GTFS data exported. Be sure to first import data into SQLite.');
    return;
  }

  log(`Completed GTFS export to ${exportPath}`);

  log(`Completed GTFS export for ${pluralize('agency', agencyCount, true)}\n`);
};

export default exportGtfs;
