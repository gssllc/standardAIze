const { Pinecone } = require("@pinecone-database/pinecone");

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});

const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

async function saveMaintenanceNote({ id, embedding, metadata }) {
    await index.namespace("maintenance-notes").upsert([
        {
            id,
            values: embedding,
            metadata,
        },
    ]);
}

async function searchSimilarNotes({ embedding, topK = 5 }) {
    const results = await index.namespace("maintenance-notes").query({
    vector: embedding,
    topK,
    includeMetadata: true,
    });

    return results.matches || [];
}

module.exports = {
    saveMaintenanceNote,
    searchSimilarNotes,
};