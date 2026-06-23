# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Upserting Deckplate Data to Pinecone

This project uses OpenAI embeddings and Pinecone to make historical maintenance records searchable by semantic similarity.

The ingestion process does the following:

```text
Excel maintenance records
        ↓
Build RAG-ready text records
        ↓
Create OpenAI embeddings
        ↓
Upsert vectors and metadata to Pinecone
```

### Prerequisites

Make sure the following values exist in `server/.env`:

```env
OPENAI_API_KEY=your_openai_api_key
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_ENDPOINT=https://api.openai.com/v1/embeddings

PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=deckplate-data
PINECONE_NAMESPACE=maintenance-notes
```

The Pinecone index must use these settings:

```text
Vector type: Dense
Dimensions: 1536
Metric: Cosine
Embedding model: text-embedding-3-small
```

### Source Data

Place the Deckplate Excel file in this location:

```text
server/data/deckplate pull.xlsx
```

Each spreadsheet row is converted into one RAG record. The generated text includes useful maintenance details such as:

```text
Type Model Series
TEC
Component and NIIN
Malfunction description and code
Discrepancy narrative
Corrective action
Maintenance level
Work center
RFI and BCM status
```

Administrative values such as costs, dates, JCN, MCN, and serial numbers are preserved as Pinecone metadata.

### Build RAG Records

From the project root, where `package.json` is located, run:

```cmd
npm run build:deckplate-rag
```

This command reads:

```text
server/data/deckplate pull.xlsx
```

and creates:

```text
server/data/deckplate_records.jsonl
```

The JSONL file contains one RAG-ready record per line:

```json
{
  "id": "deckplate-example-id",
  "text": "Maintenance history record\nType Model Series: FA-18\nTEC: AMA9\n...",
  "metadata": {
    "tec": "AMA9",
    "typeModelSeries": "FA-18",
    "malfunctionCode": "169"
  }
}
```

This build step does not call OpenAI or Pinecone, so it does not create API costs.

### Test a Small Pinecone Upsert

Before seeding the full dataset, test with 10 records.

Run this from the project root in Command Prompt:

```cmd
set SEED_LIMIT=10
npm run seed:deckplate
```

The script will:

1. Read the first 10 records from `deckplate_records.jsonl`.
2. Create embeddings using `text-embedding-3-small`.
3. Upsert those vectors into the `maintenance-notes` Pinecone namespace.

Expected output:

```text
Starting Deckplate Pinecone seed...
Index: deckplate-data
Namespace: maintenance-notes
Embedding model: text-embedding-3-small
Records to seed: 10

Seeded 10/10 records.

Deckplate Pinecone seed complete.
```

### Seed All Deckplate Records

After the small test succeeds, clear the test limit and seed the complete dataset:

```cmd
set SEED_LIMIT=
npm run seed:deckplate
```

The seed script processes records in batches, creates OpenAI embeddings, and upserts each batch to Pinecone.

The upsert format used by the application is:

```js
await namespace.upsert({
  records: [
    {
      id: "deckplate-record-id",
      values: embedding,
      metadata: {
        ragText: "Readable maintenance record text...",
        tec: "AMA9",
        typeModelSeries: "FA-18"
      }
    }
  ]
});
```

Reusing an existing Pinecone record ID updates that record instead of creating a duplicate.

### Querying Similar Maintenance Records

When the user clicks **Generate AI Note**, the application should:

```text
Current maintenance note
        ↓
Create an OpenAI embedding
        ↓
Search Pinecone for the top 10 similar records
        ↓
Send instructions + retrieved maintenance records + current note to OpenAI
        ↓
Return the generated AI maintenance note
```

The application searches Pinecone using the same embedding model that was used during ingestion:

```js
const matches = await searchSimilarNotes({
  embedding,
  topK: 10,
});
```

Each returned Pinecone match includes a similarity score and readable RAG context:

```js
match.metadata.ragText
```

That retrieved text can then be included in the OpenAI prompt as reference maintenance history.
