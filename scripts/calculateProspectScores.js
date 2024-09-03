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
    // Connect to MongoDB
    connection = await connectToMongoDB();
    console.log('Connected to MongoDB');

    // Find companies without a prospectScore, limited by maxLimit
    const companies = await Company.find({ prospectScore: { $exists: false } }).limit(maxLimit);
    console.log(`Found ${companies.length} companies without a prospectScore (max: ${maxLimit})`);

    for (const company of companies) {
      try {
        console.log(`Processing company: ${company.name}`);
        console.log(`Long description length: ${company.longDescription.length}`);

        // Calculate prospect score and neighbor metrics
        const {
          prospectScore,
          neighbors,
          numNeighborAcquisitions,
          numNeighborIPOs,
          numNeighborFailures
        } = await calculateProspectScore(company.longDescription);

        // Log the calculated scores and metrics
        console.log(`Calculated prospectScore for ${company.name}: ${prospectScore}`);
        console.log(`Number of neighbors found: ${neighbors.length}`);
        console.log(`Neighbor Acquisitions: ${numNeighborAcquisitions}`);
        console.log(`Neighbor IPOs: ${numNeighborIPOs}`);
        console.log(`Neighbor Failures: ${numNeighborFailures}`);

        // Update company with new prospectScore and neighbor metrics
        await Company.findByIdAndUpdate(company._id, {
          prospectScore,
          numNeighborAcquisitions,
          numNeighborIPOs,
          numNeighborFailures
        });
        console.log(`Updated prospectScore and neighbor metrics for ${company.name}`);
      } catch (error) {
        console.error(`Error calculating prospectScore for ${company.name}:`, error);
        // If there's an error, set default values
        await Company.findByIdAndUpdate(company._id, {
          prospectScore: 0,
          numNeighborAcquisitions: 0,
          numNeighborIPOs: 0,
          numNeighborFailures: 0
        });
        console.log(`Set default values for ${company.name} due to error`);
      }
    }

    console.log('Finished calculating prospect scores and neighbor metrics');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the MongoDB connection
    if (connection) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
  }
}

// Run command
if (require.main === module) {
  const maxLimit = process.argv[2] ? parseInt(process.argv[2], 10) : Infinity;
  calculateAllProspectScores(maxLimit).catch(console.error);
}

module.exports = calculateAllProspectScores;

