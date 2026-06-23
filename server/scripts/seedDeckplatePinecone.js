const fs = require("node:fs/promises");
const path = require("node:path");

require("dotenv").config({
    path: path.join(__dirname, "..", ".env"),
    override: true,
});

    const OpenAI = require("openai");
    const { Pinecone } = require("@pinecone-database/pinecone");

    const INPUT_FILE_PATH = path.join(
    __dirname,
    "..",
    "data",
    "deckplate_records.jsonl"
    );

    /*
    32 records per OpenAI request.

    6,423 records means roughly 201 embedding batches.
    The script processes batches sequentially to avoid sending too many
    OpenAI or Pinecone requests at once.
    */
    const DEFAULT_EMBEDDING_BATCH_SIZE = 32;

    const PINECONE_NAMESPACE =
    process.env.PINECONE_NAMESPACE || "maintenance-notes";

    const EXPECTED_VECTOR_DIMENSIONS = 1536;

    /*
    This protects Pinecone metadata from becoming too large.
    Your build script already limits the long text fields, so this is
    primarily an extra safety check.
    */
    const MAX_RAG_TEXT_METADATA_CHARACTERS = 8000;

    const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    });

    const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    });

    function sleep(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
    }

    function getOptionalPositiveInteger(environmentVariableName) {
    const value = Number(process.env[environmentVariableName]);

    if (!Number.isFinite(value) || value <= 0) {
        return null;
    }

    return Math.floor(value);
    }

    function getEmbeddingBatchSize() {
    const configuredBatchSize = getOptionalPositiveInteger(
        "SEED_BATCH_SIZE"
    );

    if (!configuredBatchSize) {
        return DEFAULT_EMBEDDING_BATCH_SIZE;
    }

    /*
        Keep the batch size in a reasonable range.
    */
    return Math.min(Math.max(configuredBatchSize, 1), 100);
    }

    function truncateText(text, maxLength = MAX_RAG_TEXT_METADATA_CHARACTERS) {
    if (typeof text !== "string") {
        return "";
    }

    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength).trim()}\n[Text truncated]`;
    }

    function getErrorStatusCode(error) {
    return Number(
        error?.status ||
        error?.statusCode ||
        error?.response?.status ||
        0
    );
    }

    function isRetryableError(error) {
    const statusCode = getErrorStatusCode(error);

    /*
        A missing status code usually indicates a temporary connection issue.
    */
    if (!statusCode) {
        return true;
    }

    return [408, 429, 500, 502, 503, 504].includes(statusCode);
    }

    async function runWithRetry(
    operation,
    operationName,
    maxAttempts = 4
    ) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
        return await operation();
        } catch (error) {
        const isFinalAttempt = attempt === maxAttempts;

        if (isFinalAttempt || !isRetryableError(error)) {
            throw error;
        }

        const delayMilliseconds = 1000 * 2 ** (attempt - 1);

        console.warn(
            `${operationName} failed on attempt ${attempt}/${maxAttempts}. ` +
            `Retrying in ${delayMilliseconds / 1000} second(s).`
        );

        await sleep(delayMilliseconds);
        }
    }
    }

    function validateEnvironmentVariables() {
    const requiredEnvironmentVariables = [
        "OPENAI_API_KEY",
        "EMBEDDING_MODEL",
        "PINECONE_API_KEY",
        "PINECONE_INDEX_NAME",
    ];

    const missingEnvironmentVariables =
        requiredEnvironmentVariables.filter(
        (environmentVariableName) =>
            !process.env[environmentVariableName]
        );

    if (missingEnvironmentVariables.length > 0) {
        throw new Error(
        `Missing values in server/.env: ${missingEnvironmentVariables.join(
            ", "
        )}`
        );
    }
    }

    async function readDeckplateRecords() {
    const fileContents = await fs.readFile(INPUT_FILE_PATH, "utf8");

    const records = fileContents
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line, index) => {
        try {
            return JSON.parse(line);
        } catch {
            throw new Error(
            `Invalid JSON found on line ${index + 1} of deckplate_records.jsonl.`
            );
        }
        });

    if (records.length === 0) {
        throw new Error(
        "deckplate_records.jsonl does not contain any records."
        );
    }

    return records;
    }

    async function generateEmbeddings(texts) {
    const response = await runWithRetry(
        () =>
        openai.embeddings.create({
            model: process.env.EMBEDDING_MODEL,
            input: texts,
            encoding_format: "float",
        }),
        "OpenAI embedding request"
    );

    const embeddings = response.data
        .sort((firstItem, secondItem) => {
        return firstItem.index - secondItem.index;
        })
        .map((item) => item.embedding);

    if (embeddings.length !== texts.length) {
        throw new Error(
        `Expected ${texts.length} embeddings but received ${embeddings.length}.`
        );
    }

    for (const embedding of embeddings) {
        if (
        !Array.isArray(embedding) ||
        embedding.length !== EXPECTED_VECTOR_DIMENSIONS
        ) {
        throw new Error(
            `Expected a ${EXPECTED_VECTOR_DIMENSIONS}-dimension embedding, ` +
            `but received ${embedding?.length || 0}.`
        );
        }
    }

    return embeddings;
    }

    function buildPineconeVector(record, embedding) {
    return {
        id: record.id,
        values: embedding,
        metadata: {
        ...record.metadata,
        dataset: "deckplate",
        ragText: truncateText(record.text),
        },
    };
    }

    async function main() {
    validateEnvironmentVariables();

    const allRecords = await readDeckplateRecords();

    /*
        SEED_LIMIT lets us test with a small number of records first.

        Example:
        set SEED_LIMIT=10
        npm run seed:deckplate
    */
    const seedLimit = getOptionalPositiveInteger("SEED_LIMIT");

    const records = seedLimit
        ? allRecords.slice(0, seedLimit)
        : allRecords;

    const embeddingBatchSize = getEmbeddingBatchSize();

    const index = pinecone
        .index(process.env.PINECONE_INDEX_NAME)
        .namespace(PINECONE_NAMESPACE);

    console.log("\nStarting Deckplate Pinecone seed...");
    console.log(`Index: ${process.env.PINECONE_INDEX_NAME}`);
    console.log(`Namespace: ${PINECONE_NAMESPACE}`);
    console.log(`Embedding model: ${process.env.EMBEDDING_MODEL}`);
    console.log(`Records to seed: ${records.length}`);
    console.log(`Batch size: ${embeddingBatchSize}\n`);

    let seededRecordCount = 0;

    for (
        let startIndex = 0;
        startIndex < records.length;
        startIndex += embeddingBatchSize
    ) {
        const batch = records.slice(
        startIndex,
        startIndex + embeddingBatchSize
        );

        const texts = batch.map((record) => record.text);

        const embeddings = await generateEmbeddings(texts);

        const vectors = batch.map((record, index) => {
        return buildPineconeVector(record, embeddings[index]);
        });

        await runWithRetry(
        () =>
            index.upsert({
            records: vectors,
            }),
        "Pinecone upsert request"
        );

        seededRecordCount += batch.length;

        console.log(
        `Seeded ${seededRecordCount}/${records.length} records.`
        );
    }

    console.log("\nDeckplate Pinecone seed complete.");
    console.log(
        `Successfully upserted ${seededRecordCount} records into ` +
        `"${PINECONE_NAMESPACE}".`
    );

    try {
        const stats = await index.describeIndexStats();

        const namespaceRecordCount =
        stats?.namespaces?.[PINECONE_NAMESPACE]?.recordCount;

        if (namespaceRecordCount !== undefined) {
        console.log(
            `Pinecone reports ${namespaceRecordCount} record(s) in the namespace.`
        );
        }
    } catch (error) {
        console.warn(
        "Seed completed, but Pinecone statistics could not be retrieved:",
        error.message
        );
    }
    }

    main().catch((error) => {
    console.error("\nDeckplate seed failed.");
    console.error(error.message);
    process.exit(1);
});