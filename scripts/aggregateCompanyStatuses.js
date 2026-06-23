const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const inputFilePath = 'datasets/yc-companies-descriptions.csv';
const outputFilePath = 'datasets/company_statuses_by_batch.csv';

const results = {};

fs.createReadStream(inputFilePath)
  .pipe(csv())
  .on('data', (row) => {
    const batch = row.batch;
    const status = row.status.toLowerCase();

    if (!results[batch]) {
      results[batch] = { active: 0, inactive: 0, public: 0, acquired: 0 };
    }

    if (status === 'active') results[batch].active++;
    else if (status === 'inactive') results[batch].inactive++;
    else if (status === 'public') results[batch].public++;
    else if (status === 'acquired') results[batch].acquired++;
  })
  .on('end', () => {
    const csvWriter = createCsvWriter({
      path: outputFilePath,
      header: [
        { id: 'batch', title: 'Batch' },
        { id: 'active', title: 'Active' },
        { id: 'inactive', title: 'Inactive' },
        { id: 'public', title: 'Public' },
        { id: 'acquired', title: 'Acquired' },
        { id: 'activePercentage', title: 'Active Percentage' },
        { id: 'inactivePercentage', title: 'Inactive Percentage' },
        { id: 'publicPercentage', title: 'Public Percentage' },
        { id: 'acquiredPercentage', title: 'Acquired Percentage' },
      ]
    });

    const outputData = Object.keys(results).map(batch => {
      const total = results[batch].active + results[batch].inactive + results[batch].public + results[batch].acquired;
      return {
        batch,
        active: results[batch].active,
        inactive: results[batch].inactive,
        public: results[batch].public,
        acquired: results[batch].acquired,
        activePercentage: ((results[batch].active / total) * 100).toFixed(2),
        inactivePercentage: ((results[batch].inactive / total) * 100).toFixed(2),
        publicPercentage: ((results[batch].public / total) * 100).toFixed(2),
        acquiredPercentage: ((results[batch].acquired / total) * 100).toFixed(2),
      };
    });

    // Sort batches in chronological order
    outputData.sort((a, b) => {
      const parseBatch = (batch) => {
        const [season, year] = batch.split(/(\d+)/).filter(Boolean);
        return { season, year: parseInt(year) };
      };
      const aParsed = parseBatch(a.batch);
      const bParsed = parseBatch(b.batch);
      return aParsed.year - bParsed.year || (aParsed.season < bParsed.season ? -1 : 1);
    });

    csvWriter.writeRecords(outputData)
      .then(() => console.log('CSV file written successfully.'));
  });