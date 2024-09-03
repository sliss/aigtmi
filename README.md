# aigtmi

Calculate a startup's odds of success from its description.

1. generate embeddings of all YC companies on long_description and save to astra. entries contain name, url, batch, long desc, short desc, status, tags
2. for a company, calculate its prospectScore. find the 50 nearest neighbors by long_description similarity. numerator: +.8 for acquisition, +1 for IPO, -1 for inactive, +0 for active. TODO: weigh the raw scores by similarity/distance. curse of dimensionality makes this tricky. Probably need to choose the shape of the exponential decay specific to each KNN cluster result.
3. run this on each of the companies in the DB and assign each its prospect score.
4. pull all prospectScores for analysis purposes. extract and save 20 points to use for fast percentile calculations

User interface:
enter company description
show list of 50 similar startups, ranked by similarity: name, URL, short description, status, batch. Color code by status.
Tweet to share: “my startup is <AI 1-liner>. We are <x>% likely to succeed. Try your luck here <link>

# database

Mongoose and mongodb atlas for both company document data and their embeddings.

# integrations

nomic for the embeddings.

# datasets

loadData.js will load the YC companies into the database. each document contains name, url, batch, long desc, short desc, status, tags, and its nomic embedding (512 dimensions)
