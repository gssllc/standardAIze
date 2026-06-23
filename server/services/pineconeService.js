const { Pinecone } = require("@pinecone-database/pinecone");

const PINECONE_NAMESPACE =
    process.env.PINECONE_NAMESPACE || "maintenance-notes";

if (!process.env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY is missing from server/.env.");
}

if (!process.env.PINECONE_INDEX_NAME) {
    throw new Error("PINECONE_INDEX_NAME is missing from server/.env.");
}

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});

const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

function getMaintenanceNotesNamespace() {
    return index.namespace(PINECONE_NAMESPACE);
}

/**
 * Stores one maintenance note embedding in Pinecone.
 *
 * @param {object} params
 * @param {string|number} params.id Permanent ID for this note.
 * @param {number[]} params.embedding OpenAI embedding vector.
 * @param {object} params.metadata Readable note data returned in searches.
 * @returns {Promise<void>}
 */
async function saveMaintenanceNote({ id, embedding, metadata }) {
    if (id === undefined || id === null || id === "") {
        throw new Error("A maintenance-note ID is required.");
    }

    if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("A valid embedding array is required.");
    }

    if (embedding.length !== 1536) {
        throw new Error(
        `Expected a 1536-dimension embedding, but received ${embedding.length}.`
        );
    }

    const namespace = getMaintenanceNotesNamespace();

    await namespace.upsert({
        records: [
        {
            id: String(id),
            values: embedding,
            metadata: metadata || {},
        },
        ],
    });
}

/**
 * Searches Pinecone for maintenance notes similar to the supplied embedding.
 *
 * @param {object} params
 * @param {number[]} params.embedding OpenAI embedding vector for the new note.
 * @param {number} [params.topK=5] Maximum matches returned.
 * @param {number} [params.minScore=0] Minimum cosine similarity score.
 * @returns {Promise<Array>}
 */
async function searchSimilarNotes({
    embedding,
    topK = 5,
    minScore = 0,
    }) {
    if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("A valid embedding array is required.");
    }

    if (embedding.length !== 1536) {
        throw new Error(
        `Expected a 1536-dimension embedding, but received ${embedding.length}.`
        );
    }

    const safeTopK = Math.min(Math.max(Number(topK) || 5, 1), 20);

    const safeMinScore = Math.min(
        Math.max(Number(minScore) || 0, 0),
        1
    );

    const namespace = getMaintenanceNotesNamespace();

    const results = await namespace.query({
        vector: embedding,
        topK: safeTopK,
        includeMetadata: true,
    });

    const matches = Array.isArray(results.matches)
        ? results.matches
        : [];

    return matches.filter(
        (match) => Number(match.score) >= safeMinScore
    );
}

module.exports = {
    saveMaintenanceNote,
    searchSimilarNotes,
};