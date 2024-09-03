const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: String,
  website: String,
  longDescription: String,
  oneLiner: String,
  teamSize: Number,
  industry: String,
  subindustry: String,
  tags: [String],
  topCompany: Boolean,
  nonprofit: Boolean,
  batch: String,
  status: String,
  stage: String,
  isYCCompany: Boolean,
  prospectScore: Number,
  prospectPercentile: Number,
  // total outcomes for the neighbors by acquisition, ipo, or failure
  numNeighborAcquisitions: Number,
  numNeighborIPOs: Number,
  numNeighborFailures: Number,
  embedding: [Number]
});

module.exports = mongoose.model('Company', companySchema);
