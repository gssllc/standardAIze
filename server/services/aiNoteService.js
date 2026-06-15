const OpenAI = require("openai");
const { saveMaintenanceNote, searchSimilarNotes } = require("./pineconeService");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function createEmbedding(text) {
    const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
    });

    return embeddingResponse.data[0].embedding;
}

async function generateMaintenanceAiNote(rawNote) {
    const rawEmbedding = await createEmbedding(rawNote);

        const similarNotes = await searchSimilarNotes({
        embedding: rawEmbedding,
        topK: 5,
    });

    const trendContext = similarNotes
    .map((match, index) => {
        return `Similar Note ${index + 1}:\n${match.metadata?.cleanedNote || match.metadata?.rawNote || ""}`;
    })
    .join("\n\n");

    const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
    {
        role: "system",
        content: `
You are an AI assistant for maintenance workers.

Your job is to:
1. Clean up raw maintenance notes.
2. Make them professional and easy to understand.
3. Identify the likely equipment, part, issue, and severity.
4. Suggest next steps.
5. Mention any possible trend based on similar historical notes.

Return the answer in a clear maintenance report format.
        `,
      },
        {
        role: "user",
        content: `
Raw maintenance note:
${rawNote}

Similar historical notes:
${trendContext || "No similar historical notes found yet."}
        `,
        },
    ],
});

    const aiNote = completion.choices[0].message.content;

    const aiNoteEmbedding = await createEmbedding(aiNote);

    await saveMaintenanceNote({
        id: `note-${Date.now()}`,
        embedding: aiNoteEmbedding,
        metadata: {
        rawNote,
        cleanedNote: aiNote,
        createdAt: new Date().toISOString(),
        },
    });

    return aiNote;
}

module.exports = {
    generateMaintenanceAiNote,
};