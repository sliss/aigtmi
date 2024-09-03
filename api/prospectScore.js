const Company = require('../db/company');
const { createEmbeddings } = require('../integrations/nomic');

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

  return {
    prospectScore,
    prospectPercentile: userPercentile,
    neighbors,
    numNeighborAcquisitions,
    numNeighborIPOs,
    numNeighborFailures
  };
}

module.exports = { calculateProspectScore };