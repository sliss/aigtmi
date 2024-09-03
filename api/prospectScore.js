const mongoose = require('mongoose');
const { createEmbeddings } = require('../integrations/nomic');
const OpenAI = require('openai');
const Company = require('../db/company');
require('dotenv').config();

const MONGODB_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 25000,
  socketTimeoutMS: 45000,
};

async function connectToMongoDB() {
  try {
    if (mongoose.connection.readyState === 0) {
      console.log('Connecting to MongoDB');
      await mongoose.connect(process.env.MONGODB_CONNECTION_STRING, MONGODB_OPTIONS);
      console.log('Connected to MongoDB');
    }
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateOneLiner(description) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that generates one-liner summaries for startup descriptions."
        },
        {
          role: "user",
          content: `Generate a one-liner summary (max 50 characters) for the following startup description:\n\n${description}`
        }
      ],
      max_tokens: 50,
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating one-liner:', error);
    throw error;
  }
}

async function calculateProspectScore(description) {
  // Generate embedding for the input description
  const embedding = await createEmbeddings([description]);

  // Ensure embedding is an array
  const embeddingVector = Array.isArray(embedding) ? embedding[0] : embedding;
  console.log('Embedding vector:', embeddingVector.slice(0, 5) + '...'); // Log first 5 elements

  // Find 50 nearest neighbors using the $vectorSearch syntax
  const neighbors = await Company.aggregate([
    {
      $vectorSearch: {
        index: "vector_index", // Replace with your actual index name
        path: "embedding",
        queryVector: embeddingVector,
        numCandidates: 100,
        limit: 50,
      }
    },
    {
      $project: {
        name: 1,
        website: 1,
        oneLiner: 1,
        status: 1,
        batch: 1,
        prospectScore: 1,
        prospectPercentile: 1,
        score: { $meta: "vectorSearchScore" }
      }
    }
  ]);

  console.log(`Found ${neighbors.length} YC company neighbors`);

  if (neighbors.length === 0) {
    console.log('No YC company neighbors found. Checking database for YC companies with embeddings...');
    const companiesWithEmbeddings = await Company.countDocuments({ isYCCompany: true, embedding: { $exists: true, $ne: [] } });
    console.log(`Number of YC companies with embeddings: ${companiesWithEmbeddings}`);

    if (companiesWithEmbeddings === 0) {
      console.log('No YC companies with embeddings found in the database.');
      return { prospectScore: 0, neighbors: [] };
    }
  }

  // Calculate prospect score
  let prospectScore = 0;
  let numNeighborAcquisitions = 0;
  let numNeighborIPOs = 0;
  let numNeighborFailures = 0;

  if (neighbors.length > 0) {
    neighbors.forEach(company => {
      if (company.status === 'Acquired') {
        prospectScore += 0.8;
        numNeighborAcquisitions++;
      } else if (company.status === 'IPO') {
        prospectScore += 1;
        numNeighborIPOs++;
      } else if (company.status === 'Inactive') {
        prospectScore -= 1;
        numNeighborFailures++;
      }
    });
    prospectScore /= neighbors.length;
  }

  // Ensure prospectScore is a valid number
  prospectScore = isNaN(prospectScore) ? 0 : prospectScore;

  // Calculate percentile for the user's company
  const totalCompanies = await Company.countDocuments();
  const companiesWithLowerScore = await Company.countDocuments({ prospectScore: { $lt: prospectScore } });
  const userPercentile = (companiesWithLowerScore / totalCompanies) * 100;

  console.log(`Calculated prospect score: ${prospectScore}`);
  console.log(`Calculated percentile: ${userPercentile.toFixed(2)}%`);
  console.log(`Neighbor Acquisitions: ${numNeighborAcquisitions}`);
  console.log(`Neighbor IPOs: ${numNeighborIPOs}`);
  console.log(`Neighbor Failures: ${numNeighborFailures}`);

  // Generate one-liner summary
  const oneLiner = await generateOneLiner(description);
  console.log(`Generated one-liner: ${oneLiner}`);

  return {
    prospectScore,
    prospectPercentile: userPercentile,
    neighbors,
    numNeighborAcquisitions,
    numNeighborIPOs,
    numNeighborFailures,
    oneLiner
  };
}

module.exports = async (req, res) => {
  console.log('Received request to calculate prospect score');
  if (req.method === 'POST') {
    try {
      console.log('Connecting to MongoDB');
      await connectToMongoDB();
      console.log('MongoDB connected');

      const { description } = req.body;
      console.log('Received description:', description);

      console.log('Calculating prospect score');
      const result = await calculateProspectScore(description);
      console.log('Prospect score calculated:', result);

      res.json(result);
    } catch (error) {
      console.error('Error calculating prospect score:', error);
      res.status(500).json({ error: 'An error occurred while calculating the prospect score', details: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};