// test that we can connect to the database
const mongoose = require('mongoose');
require('dotenv').config();
async function testMongoConnection() {
  try {
    await mongoose.connect(process.env.MONGODB_CONNECTION_STRING, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
  }
}

testMongoConnection().catch(console.error);