const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate an embedding vector for a user's text query.
 *
 * Python equivalent:
 * generate_user_query_embedding(user_query, openai_api_key)
 *
 * @param {string} userQuery
 * @returns {Promise<number[]>}
 */
async function generateUserQueryEmbedding(userQuery) {
    if (typeof userQuery !== "string" || !userQuery.trim()) {
        throw new Error("A non-empty user query is required.");
    }

    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is missing from server/.env.");
    }

    if (!process.env.EMBEDDING_MODEL) {
        throw new Error("EMBEDDING_MODEL is missing from server/.env.");
    }

    const cleanedQuery = userQuery.trim();

    try {
        const response = await openai.embeddings.create({
        model: process.env.EMBEDDING_MODEL,
        input: cleanedQuery,
        encoding_format: "float",
    });

    const embedding = response?.data?.[0]?.embedding;

    if (!Array.isArray(embedding)) {
        throw new Error("OpenAI did not return a valid embedding vector.");
        }

        return embedding.map(Number);
    } catch (error) {
        console.error("Embedding generation error:", error);

        throw new Error(
        `Failed to generate an embedding: ${error.message || "Unknown error"}`
        );
    }
}

module.exports = {
    generateUserQueryEmbedding,
};