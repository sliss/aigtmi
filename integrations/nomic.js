'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const axios = require('axios');

const NOMIC_KEY = process.env.NOMIC_KEY;

/**
 * This function makes a POST request to the Nomic API to generate embeddings for a given list of texts.
 * It retries the request up to 3 times if necessary and returns the resulting embeddings.
 *
 * @param {Array} texts - A list of texts for which embeddings need to be generated.
 * @param {Object} options - An optional object that can contain the following properties:
 *   - model (string): The name of the embedding model to use (default: 'nomic-embed-text-v1.5').
 *   - dimensionality (number): The dimensionality of the embeddings (default: 512).
 *   - task_type (string): The type of task for which the embeddings will be used (default: 'classification').
 *     Can be search_query, search_document, clustering, classification
 * @returns {Array} - An array of embeddings generated for the given texts.
 *   If only 1 embedding is generated, it is returned directly.
 */
async function createEmbeddings(texts, options = {}) {
  const {
    model = 'nomic-embed-text-v1.5',
    dimensionality = 512,
    task_type = 'clustering' // search_query, search_document, clustering, classification
  } = options;
  // console.log('nomic key', NOMIC_KEY);
  let embeddings = null;
  // Retry up to 3 times if necessary, because OpenAI API flakes
  // out relatively frequently.
  for (let i = 0; i < 3; ++i) {
    // Add this check before making the API call
    if (!texts || texts.length === 0 || texts.some(text => text == null)) {
      throw new Error('Invalid input: texts array must not be empty and must not contain null values');
    }

    const data = {
      model,
      dimensionality,
      texts,
      task_type
    };

    // console.log('Sending data to Nomic API:', JSON.stringify(data, null, 2));

    try {
      embeddings = await axios.post('https://api-atlas.nomic.ai/v1/embedding/text', data, {
        headers: {
          Authorization: `Bearer ${NOMIC_KEY}`,
          'Content-Type': 'application/json'
        }
      }).then(res => res.data.embeddings);

      // Ensure we're always returning an array of embeddings
      return Array.isArray(embeddings) ? embeddings : [embeddings];
    } catch (err) {
      console.error('Error response from Nomic API:', err.response?.data);
      throw err;
    }
  }
}

// test the embedding function
// (async () => {
//   const texts = [
//     'I am a sentence',
//   ];
//   const embeddings = await createEmbeddings(texts, { dimensionality: 512, task_type: 'clustering' });
//   console.log('embeddings resp', embeddings);
// })();

exports.createEmbeddings = createEmbeddings;


