const fs = require('fs');
const path = require('path');
const csv = require('csv-writer').createObjectCsvWriter;
const mongoose = require('mongoose');
const Company = require('../db/company');
require('dotenv').config();

// MongoDB connection setup
const MONGODB_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 25000,
  socketTimeoutMS: 45000,
};

async function connectToMongoDB() {
  try {
    console.log('Connecting to MongoDB', process.env.MONGODB_CONNECTION_STRING);
    const connection = await mongoose.connect(process.env.MONGODB_CONNECTION_STRING, MONGODB_OPTIONS);
    console.log('Connected to MongoDB');
    return connection;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

async function exportCompanies() {
  let connection;

  try {
    connection = await connectToMongoDB();

    // Define the CSV file path
    const csvFilePath = path.join(__dirname, '../exports', 'companies_with_prospect_scores.csv');

    // Define the CSV writer
    const csvWriter = csv({
      path: csvFilePath,
      header: [
        { id: 'name', title: 'Name' },
        { id: 'website', title: 'Website' },
        { id: 'batch', title: 'Batch' },
        { id: 'status', title: 'Status' },
        { id: 'stage', title: 'Stage' },
        { id: 'industry', title: 'Industry' },
        { id: 'subindustry', title: 'Subindustry' },
        { id: 'teamSize', title: 'Team Size' },
        { id: 'tags', title: 'Tags' },
        { id: 'topCompany', title: 'Top Company' },
        { id: 'nonprofit', title: 'Nonprofit' },
        { id: 'isYCCompany', title: 'Is YC Company' },
        { id: 'oneLiner', title: 'One Liner' },
        { id: 'longDescription', title: 'Long Description' },
        { id: 'prospectScore', title: 'Prospect Score' },
        { id: 'numNeighborAcquisitions', title: 'Neighbor Acquisitions' },
        { id: 'numNeighborIPOs', title: 'Neighbor IPOs' },
        { id: 'numNeighborFailures', title: 'Neighbor Failures' }
      ]
    });

    const batchSize = 500; // Adjust this value based on your system's capabilities
    let skip = 0;
    let totalExported = 0;

    while (true) {
      // Fetch companies in batches
      const companies = await Company.find({ prospectScore: { $exists: true } })
        .skip(skip)
        .limit(batchSize)
        .lean(); // Use lean() for better performance as we don't need Mongoose documents

      if (companies.length === 0) {
        break; // No more companies to process
      }

      // Prepare the data for CSV
      const records = companies.map(company => ({
        name: company.name,
        website: company.website,
        batch: company.batch,
        status: company.status,
        stage: company.stage,
        industry: company.industry,
        subindustry: company.subindustry,
        teamSize: company.teamSize,
        tags: company.tags.join(', '),
        topCompany: company.topCompany,
        nonprofit: company.nonprofit,
        isYCCompany: company.isYCCompany,
        oneLiner: company.oneLiner,
        longDescription: company.longDescription,
        prospectScore: company.prospectScore,
        numNeighborAcquisitions: company.numNeighborAcquisitions,
        numNeighborIPOs: company.numNeighborIPOs,
        numNeighborFailures: company.numNeighborFailures
      }));

      // Write batch to CSV
      await csvWriter.writeRecords(records);

      totalExported += companies.length;
      console.log(`Exported ${totalExported} companies`);

      skip += batchSize;
    }

    console.log(`CSV file has been written to ${csvFilePath}`);
    console.log(`Total companies exported: ${totalExported}`);
  } catch (error) {
    console.error('Error exporting companies:', error);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
  }
}

// Run the export function
exportCompanies().catch(console.error);