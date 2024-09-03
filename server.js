const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { calculateProspectScore } = require('./api/prospectScore');

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_CONNECTION_STRING, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Error connecting to MongoDB:', err));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.post('/api/calculate-prospect', async (req, res) => {
  try {
    const { description } = req.body;
    const result = await calculateProspectScore(description);
    res.json(result);
  } catch (error) {
    console.error('Error calculating prospect score:', error);
    res.status(500).json({ error: 'An error occurred while calculating the prospect score' });
  }
});

// Export the Express app
module.exports = app;