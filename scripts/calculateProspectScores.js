// Calculate prospect scores for all companies
// run command: node calculateProspectScores.js <maxLimit>
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Company = require('../db/company');
const { calculateProspectScore } = require('../api/prospectScore');

dotenv.config();

// Add these constants at the top of the file
const MONGODB_CONNECTION_STRING = process.env.MONGODB_CONNECTION_STRING;
const MONGODB_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 25000,
  socketTimeoutMS: 45000,
};

async function connectToMongoDB() {
  try {
    console.log('Connecting to MongoDB');
    const connection = await mongoose.connect(process.env.MONGODB_CONNECTION_STRING, MONGODB_OPTIONS);
    console.log('Connected to MongoDB');
    return connection;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

async function calculateAllProspectScores(maxLimit = Infinity) {
  console.log('Calculating prospect scores...');
  let connection;

  try {
    connection = await connectToMongoDB();
    console.log('Connected to MongoDB');

    const companies = await Company.find({
      $or: [
        { prospectScore: { $exists: false } },
        { prospectScore: 0 }
      ]
    }).limit(maxLimit);
    console.log(`Found ${companies.length} companies to process (max: ${maxLimit})`);

    for (const company of companies) {
      try {
        console.log(`Processing company: ${company.name}`);
        const {
          prospectScore,
          neighbors,
          numNeighborAcquisitions,
          numNeighborIPOs,
          numNeighborFailures
        } = await calculateProspectScore(company.longDescription);

        await Company.findByIdAndUpdate(company._id, {
          prospectScore,
          numNeighborAcquisitions,
          numNeighborIPOs,
          numNeighborFailures
        });
        console.log(`Updated prospectScore and neighbor metrics for ${company.name}`);
      } catch (error) {
        console.error(`Error calculating prospectScore for ${company.name}:`, error);
        await Company.findByIdAndUpdate(company._id, {
          prospectScore: 0,
          numNeighborAcquisitions: 0,
          numNeighborIPOs: 0,
          numNeighborFailures: 0
        });
      }
    }

    console.log('Finished calculating prospect scores and neighbor metrics');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
  }
}

async function calculateAllPercentiles() {
  console.log('Calculating percentiles...');
  let connection;

  try {
    connection = await connectToMongoDB();
    console.log('Connected to MongoDB');

    const totalCompanies = await Company.countDocuments();
    console.log(`Total companies: ${totalCompanies}`);

    const batchSize = 1000;
    let processedCount = 0;

    // First, rank all companies by prospect score
    await Company.aggregate([
      { $sort: { prospectScore: 1 } },
      {
        $group: {
          _id: null,
          companies: { $push: { _id: "$_id", prospectScore: "$prospectScore" } }
        }
      },
      { $unwind: { path: "$companies", includeArrayIndex: "rank" } },
      {
        $project: {
          _id: "$companies._id",
          prospectScore: "$companies.prospectScore",
          rank: 1
        }
      },
      { $out: "rankedCompanies" }
    ]).allowDiskUse(true);

    console.log('Companies ranked');

    // Now update percentiles in batches
    while (processedCount < totalCompanies) {
      const rankedCompanies = await mongoose.connection.db.collection('rankedCompanies')
        .find()
        .skip(processedCount)
        .limit(batchSize)
        .toArray();

      const bulkOps = rankedCompanies.map(company => ({
        updateOne: {
          filter: { _id: company._id },
          update: { $set: { prospectPercentile: (company.rank / (totalCompanies - 1)) * 100 } }
        }
      }));

      await Company.bulkWrite(bulkOps);

      processedCount += rankedCompanies.length;
      console.log(`Processed ${processedCount}/${totalCompanies} companies`);
    }

    // Clean up the temporary collection
    await mongoose.connection.db.dropCollection('rankedCompanies');

    console.log('Finished calculating percentiles');
  } catch (error) {
    console.error('Error calculating percentiles:', error);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
  }
}

// Run command
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const maxLimit = args[1] ? parseInt(args[1], 10) : Infinity;

  if (command === 'scores') {
    calculateAllProspectScores(maxLimit).catch(console.error);
  } else if (command === 'percentiles') {
    calculateAllPercentiles().catch(console.error);
  } else if (command === 'all') {
    (async () => {
      await calculateAllProspectScores(maxLimit);
      await calculateAllPercentiles();
    })().catch(console.error);
  } else {
    console.log('Usage: node calculateProspectScores.js [scores|percentiles|all] [maxLimit]');
  }
}

module.exports = { calculateAllProspectScores, calculateAllPercentiles };

