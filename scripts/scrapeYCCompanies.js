const axios = require('axios');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');

const CSV_PATH = path.resolve(__dirname, '../datasets/yc-companies-descriptions.csv');
const API_BASE = 'https://api.ycombinator.com/v0.1/companies';
const DELAY_MS = 300; // be polite to the API

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadExistingCompanies() {
  return new Promise((resolve, reject) => {
    const existing = new Set();
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', row => existing.add(row.website?.trim().toLowerCase()))
      .on('end', () => {
        console.log(`Loaded ${existing.size} existing companies from CSV`);
        resolve(existing);
      })
      .on('error', reject);
  });
}

function mapCompany(c) {
  return {
    name: c.name || '',
    website: c.website || '',
    long_description: (c.longDescription || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    one_liner: c.oneLiner || '',
    team_size: c.teamSize ?? 0,
    industry: c.industries?.[0] || '',
    subindustry: c.industries?.join(' -> ') || '',
    tags: JSON.stringify(c.tags || []),
    top_company: c.badges?.includes('top_company') ? 'TRUE' : 'FALSE',
    nonprofit: 'FALSE',
    batch: c.batch || '',
    status: c.status || '',
    stage: '',
  };
}

async function fetchAllCompanies() {
  let page = 1;
  let totalPages = null;
  const all = [];

  while (true) {
    console.log(`Fetching page ${page}${totalPages ? `/${totalPages}` : ''}...`);
    const { data } = await axios.get(API_BASE, { params: { page } });

    totalPages = data.totalPages;
    all.push(...data.companies);

    if (!data.nextPage || page >= totalPages) break;
    page++;
    await sleep(DELAY_MS);
  }

  console.log(`Fetched ${all.length} companies from YC API`);
  return all;
}

async function main() {
  const existing = await loadExistingCompanies();
  const fetched = await fetchAllCompanies();

  const newCompanies = fetched
    .filter(c => c.website && !existing.has(c.website.trim().toLowerCase()))
    .filter(c => c.longDescription && c.longDescription.length > 10)
    .map(mapCompany);

  console.log(`Found ${newCompanies.length} new companies to add`);

  if (newCompanies.length === 0) {
    console.log('Nothing to add — CSV is already up to date.');
    return;
  }

  const writer = createObjectCsvWriter({
    path: CSV_PATH,
    header: [
      { id: 'name', title: 'name' },
      { id: 'website', title: 'website' },
      { id: 'long_description', title: 'long_description' },
      { id: 'one_liner', title: 'one_liner' },
      { id: 'team_size', title: 'team_size' },
      { id: 'industry', title: 'industry' },
      { id: 'subindustry', title: 'subindustry' },
      { id: 'tags', title: 'tags' },
      { id: 'top_company', title: 'top_company' },
      { id: 'nonprofit', title: 'nonprofit' },
      { id: 'batch', title: 'batch' },
      { id: 'status', title: 'status' },
      { id: 'stage', title: 'stage' },
    ],
    append: true,
  });

  await writer.writeRecords(newCompanies);
  console.log(`Done — appended ${newCompanies.length} new companies to ${CSV_PATH}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
