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
    console.log('Connecting to MongoDB');
    const connection = await mongoose.connect(process.env.MONGODB_CONNECTION_STRING, MONGODB_OPTIONS);
    console.log('Connected to MongoDB');
    return connection;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

async function removeDuplicates() {
  let connection;

  try {
    connection = await connectToMongoDB();

    // Get all unique websites
    const uniqueWebsites = await Company.distinct('website');
    console.log(`Found ${uniqueWebsites.length} unique websites`);

    let removedCount = 0;

    for (const website of uniqueWebsites) {
      // Find all companies with this website
      const companies = await Company.find({ website }).sort({ _id: 1 });

      if (companies.length > 1) {
        // Keep the first company (oldest by _id) and remove the rest
        const [keepCompany, ...duplicates] = companies;

        console.log(`Removing ${duplicates.length} duplicates for website: ${website}`);

        for (const duplicate of duplicates) {
          await Company.findByIdAndDelete(duplicate._id);
          removedCount++;
        }
      }
    }

    console.log(`Removed ${removedCount} duplicate companies`);

  } catch (error) {
    console.error('Error removing duplicates:', error);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
  }
}

// Run the script
removeDuplicates().catch(console.error);