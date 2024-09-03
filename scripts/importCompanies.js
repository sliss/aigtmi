const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const Company = require('../db/company');
const { createEmbeddings } = require('../integrations/nomic');
require('dotenv').config();

// Add these constants at the top of the file
const MONGODB_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 25000,
  socketTimeoutMS: 45000,
};

async function connectToMongoDB() {
  try {
    console.log('Connecting to MongoDB');
    console.log('MONGODB_CONNECTION_STRING', process.env.MONGODB_CONNECTION_STRING);
    const connection = await mongoose.connect(process.env.MONGODB_CONNECTION_STRING, MONGODB_OPTIONS);
    console.log('Connected to MongoDB');
    return connection;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

async function importCompanies() {
  let connection;
  try {
    connection = await connectToMongoDB();

    const companies = [];

    // Read and parse the CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream('../datasets/yc-companies-descriptions.csv')
        .pipe(csv())
        .on('data', (row) => {
          if (row.long_description && row.long_description.length > 10) {
            companies.push(row);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`Parsed ${companies.length} valid companies from CSV`);

    // Process companies in batches
    const batchSize = 50;
    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);

      // Generate embeddings for the batch
      const descriptions = batch.map(company => company.long_description);
      const options = {
        task_type: 'clustering',
        dimensionality: 512,
      };

      const embeddings = await createEmbeddings(descriptions, options);
      console.log('Embeddings retrieved');

      // Prepare batch of companies for insertion
      const companiesToInsert = batch.map((company, index) => ({
        name: company.name,
        website: company.website,
        longDescription: company.long_description,
        oneLiner: company.one_liner,
        teamSize: parseInt(company.team_size) || 0,
        industry: company.industry,
        subindustry: company.subindustry,
        tags: company.tags.split(',').map(tag => tag.trim()),
        topCompany: company.top_company === 'TRUE',
        nonprofit: company.nonprofit === 'TRUE',
        batch: company.batch,
        status: company.status,
        stage: company.stage,
        isYCCompany: true,
        embedding: embeddings[index]
      }));

      try {
        // Batch insert companies
        await Company.insertMany(companiesToInsert, { ordered: false });
        console.log(`Saved batch of ${companiesToInsert.length} companies`);
      } catch (error) {
        console.error(`Error saving batch of companies:`, error.message);
        if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
          console.log('Attempting to reconnect to MongoDB...');
          await mongoose.disconnect();
          connection = await connectToMongoDB();
        }
      }

      console.log(`Processed batch ${i / batchSize + 1}`);
    }

    console.log('Import completed');
  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('MongoDB connection closed');
    }
  }
}

async function testImportFirstCompany() {
  console.log('testImportFirstCompany');
  await connectToMongoDB();
  let firstValidCompany = null;

  // Read and parse the CSV file to get the first valid company
  await new Promise((resolve, reject) => {
    fs.createReadStream('../datasets/yc-companies-descriptions.csv')
      .pipe(csv())
      .on('data', (row) => {
        console.log('row', row);
        if (row.long_description && row.long_description.length > 10) {
          firstValidCompany = row;
          resolve();
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  if (!firstValidCompany) {
    console.log('No valid company data found in the CSV file');
    return;
  }

  console.log('First valid company data:', firstValidCompany);

  // Generate embedding for the first valid company
  console.log('Generating embedding for the first valid company');
  const embedding = await createEmbeddings([firstValidCompany.long_description]);
  console.log('embedding retreived', embedding);
  // Create and save the company document
  const newCompany = new Company({
    name: firstValidCompany.name,
    website: firstValidCompany.website,
    longDescription: firstValidCompany.long_description,
    oneLiner: firstValidCompany.one_liner,
    teamSize: parseInt(firstValidCompany.team_size),
    industry: firstValidCompany.industry,
    subindustry: firstValidCompany.subindustry,
    tags: firstValidCompany.tags.split(',').map(tag => tag.trim()),
    topCompany: firstValidCompany.top_company === 'TRUE',
    nonprofit: firstValidCompany.nonprofit === 'TRUE',
    batch: firstValidCompany.batch,
    status: firstValidCompany.status,
    stage: firstValidCompany.stage,
    isYCCompany: True,
    embedding: embedding[0]
  });

  try {
    await newCompany.save();
    console.log(`Successfully saved first valid company: ${firstValidCompany.name}`);
  } catch (error) {
    console.error(`Error saving first valid company ${firstValidCompany.name}:`, error.message);
  }

  console.log('Test import completed');
  mongoose.disconnect();
}

// Uncomment the function you want to run
(async () => {
  try {
    await importCompanies();
  } catch (error) {
    console.error('Unhandled error:', error);
  }
})();