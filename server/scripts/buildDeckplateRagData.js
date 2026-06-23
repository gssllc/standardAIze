const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const XLSX = require("xlsx");

const INPUT_FILE_PATH = path.join(
    __dirname,
    "..",
    "data",
    "deckplate pull.xlsx"
    );

    const OUTPUT_FILE_PATH = path.join(
    __dirname,
    "..",
    "data",
    "deckplate_records.jsonl"
    );

    /*
    These limits keep each RAG record focused.

    Later, when Pinecone returns 10 similar records, their text will be
    included in the prompt sent to OpenAI. We do not want one Excel row
    to contain an enormous amount of repeated or irrelevant text.
    */
    const MAX_DISCREPANCY_CHARACTERS = 1800;
    const MAX_CORRECTIVE_ACTION_CHARACTERS = 3000;

    /**
     * Normalize an Excel header name so minor differences in capitalization,
     * spaces, slashes, or punctuation do not break field matching.
     *
     * Example:
     * "NIIN HOF Desc" and "niin-hof-desc" normalize similarly.
     *
     * @param {string} value
     * @returns {string}
     */
    function normalizeHeader(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    /**
     * Convert an Excel cell value into a clean, one-line string.
     *
     * @param {unknown} value
     * @param {number} maxLength
     * @returns {string}
     */
    function cleanText(value, maxLength = Infinity) {
    if (value === undefined || value === null) {
        return "";
    }

    const cleanedValue = String(value)
        .replace(/\s+/g, " ")
        .trim();

    if (cleanedValue.length <= maxLength) {
        return cleanedValue;
    }

    return `${cleanedValue.slice(0, maxLength).trim()}…`;
    }

    /**
     * Convert a numeric-looking cell into a real number.
     * Returns undefined for blanks or values that are not valid numbers.
     *
     * @param {unknown} value
     * @returns {number | undefined}
     */
    function toNumberOrUndefined(value) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    const cleanedValue = String(value)
        .replace(/[$,]/g, "")
        .trim();

    const parsedValue = Number(cleanedValue);

    return Number.isFinite(parsedValue)
        ? parsedValue
        : undefined;
    }

    /**
     * Remove empty values before writing Pinecone metadata.
     *
     * @param {Record<string, unknown>} metadata
     * @returns {Record<string, unknown>}
     */
    function removeEmptyMetadata(metadata) {
    return Object.fromEntries(
        Object.entries(metadata).filter(([, value]) => {
        return (
            value !== undefined &&
            value !== null &&
            value !== "" &&
            !(typeof value === "number" && Number.isNaN(value))
        );
        })
    );
    }

    /**
     * Builds a reusable function that reads a row using possible aliases
     * for each expected Excel column name.
     *
     * @param {string[]} headers
     * @returns {(row: object, aliases: string[], maxLength?: number) => string}
     */
    function createColumnReader(headers) {
    const normalizedHeaderMap = new Map();

    for (const header of headers) {
        normalizedHeaderMap.set(normalizeHeader(header), header);
    }

    return function getColumnValue(
        row,
        aliases,
        maxLength = Infinity
    ) {
        for (const alias of aliases) {
        const actualHeader = normalizedHeaderMap.get(
            normalizeHeader(alias)
        );

        if (actualHeader) {
            return cleanText(row[actualHeader], maxLength);
        }
        }

        return "";
    };
    }

    /**
     * Create a deterministic Pinecone record ID.
     *
     * The base ID stays the same when the row content stays the same.
     * If two rows happen to be identical, the source row number is added
     * to prevent duplicate Pinecone IDs.
     *
     * @param {object} fields
     * @param {number} sourceRow
     * @param {Set<string>} usedIds
     * @returns {string}
     */
    function buildRecordId(fields, sourceRow, usedIds) {
    const uniqueText = [
        fields.jcn,
        fields.mcn,
        fields.completedAt,
        fields.discrepancyNarrative,
        fields.correctiveAction,
        fields.componentNiin,
        fields.malfunctionCode,
    ].join("|");

    const hash = crypto
        .createHash("sha256")
        .update(uniqueText)
        .digest("hex")
        .slice(0, 24);

    const baseId = `deckplate-${hash}`;

    if (!usedIds.has(baseId)) {
        usedIds.add(baseId);
        return baseId;
    }

    const duplicateId = `${baseId}-row-${sourceRow}`;

    usedIds.add(duplicateId);

    return duplicateId;
    }

    /**
     * Convert common action codes into useful short labels.
     *
     * @param {string} actionTakenCode
     * @returns {string}
     */
    function getActionTakenLabel(actionTakenCode) {
    const code = cleanText(actionTakenCode).toUpperCase();

    const labels = {
        C: "Repair",
        D: "Disposition",
        F: "Failed repair",
        G: "Cannibalization",
        H: "Hold",
        M: "Modification",
        R: "Replacement",
        S: "Salvage",
        T: "Transfer",
    };

    return labels[code] || "";
    }

    /**
     * Creates the maintenance text that will later be embedded by OpenAI.
     *
     * This is deliberately different from metadata:
     * - text is for semantic similarity / RAG retrieval
     * - metadata is for structured filters and source details
     *
     * @param {object} fields
     * @returns {string}
     */
    function buildRagText(fields) {
    const componentText = fields.componentDescription
        ? `${fields.componentDescription}${
            fields.componentNiin
            ? ` (NIIN: ${fields.componentNiin})`
            : ""
        }`
        : fields.componentNiin
        ? `NIIN: ${fields.componentNiin}`
        : "";

    const malfunctionText = [
        fields.malfunctionDescription,
        fields.malfunctionCode
        ? `Code: ${fields.malfunctionCode}`
        : "",
        fields.malfunctionType
        ? `Type: ${fields.malfunctionType}`
        : "",
    ]
        .filter(Boolean)
        .join("; ");

    const actionLabel = getActionTakenLabel(
        fields.actionTakenCode
    );

    const statusText = [
        fields.rfiInd
        ? `RFI Ind: ${fields.rfiInd}`
        : "",
        fields.bcm
        ? `BCM: ${fields.bcm}`
        : "",
    ]
        .filter(Boolean)
        .join("; ");

    const lines = [
        "Maintenance history record",

        fields.typeModelSeries
        ? `Type Model Series: ${fields.typeModelSeries}`
        : "",

        fields.tec
        ? `TEC: ${fields.tec}`
        : "",

        fields.actionOrgCode
        ? `Action Org Code: ${fields.actionOrgCode}`
        : "",

        componentText
        ? `Component: ${componentText}`
        : "",

        malfunctionText
        ? `Malfunction: ${malfunctionText}`
        : "",

        fields.maintenanceLevelDescription
        ? `Maintenance Level: ${fields.maintenanceLevelDescription}`
        : "",

        fields.workCenterCode
        ? `Work Center Code: ${fields.workCenterCode}`
        : "",

        fields.actionTakenCode
        ? `Action Taken: ${
            actionLabel || "Unknown"
            } (Code: ${fields.actionTakenCode})`
        : "",

        fields.discrepancyNarrative
        ? `Discrepancy Narrative: ${fields.discrepancyNarrative}`
        : "",

        fields.correctiveAction
        ? `Corrective Action: ${fields.correctiveAction}`
        : "",

        statusText
        ? `Status: ${statusText}`
        : "",
    ];

    return lines
        .filter(Boolean)
        .join("\n");
    }

    /**
     * Determines whether a row has enough maintenance-specific information
     * to be worth embedding and saving in Pinecone.
     *
     * @param {object} fields
     * @returns {boolean}
     */
    function hasUsefulMaintenanceContent(fields) {
    return Boolean(
        fields.discrepancyNarrative ||
        fields.correctiveAction ||
        fields.malfunctionDescription ||
        fields.componentDescription
    );
    }

    /**
     * Map one Excel row into a clean RAG record.
     *
     * @param {object} row
     * @param {number} sourceRow
     * @param {string} sourceSheet
     * @param {Function} getColumnValue
     * @param {Set<string>} usedIds
     * @returns {object | null}
     */
    function buildRagRecord(
    row,
    sourceRow,
    sourceSheet,
    getColumnValue,
    usedIds
    ) {
    const fields = {
        tec: getColumnValue(row, ["TEC"]),

        typeModelSeries: getColumnValue(row, [
        "Type Model Series",
        "Type Model",
        ]),

        actionOrgCode: getColumnValue(row, [
        "Action Org Code",
        "Action Organization Code",
        ]),

        bcm: getColumnValue(row, ["BCM"]),

        rfiInd: getColumnValue(row, [
        "RFI Ind",
        "RFI Indicator",
        ]),

        completedAt: getColumnValue(row, [
        "Comp Date Time",
        "Completion Date Time",
        "Completed Date Time",
        ]),

        lastAlteredAt: getColumnValue(row, [
        "Last Altered Date Time",
        "Last Altered",
        ]),

        jcn: getColumnValue(row, ["JCN"]),

        mcn: getColumnValue(row, ["MCN"]),

        maintenanceLevel: getColumnValue(row, [
        "Maint Level",
        "Maintenance Level",
        ]),

        maintenanceLevelDescription: getColumnValue(row, [
        "Maint Level Desc",
        "Maintenance Level Desc",
        "Maintenance Level Description",
        ]),

        actionTakenCode: getColumnValue(row, [
        "Action Taken Code",
        ]),

        malfunctionCode: getColumnValue(row, [
        "Malfunction Code",
        ]),

        malfunctionDescription: getColumnValue(row, [
        "Malfunction Desc",
        "Malfunction Description",
        ]),

        malfunctionType: getColumnValue(row, [
        "Malfunction Type",
        ]),

        workCenterCode: getColumnValue(row, [
        "Work Center Code",
        "Workcenter Code",
        ]),

        discrepancyNarrative: getColumnValue(
        row,
        [
            "Descrep Narr",
            "Discrepancy Narrative",
            "Discrepancy Narr",
        ],
        MAX_DISCREPANCY_CHARACTERS
        ),

        correctiveAction: getColumnValue(
        row,
        [
            "Corr Act",
            "Corrective Action",
            "Corrective Act",
        ],
        MAX_CORRECTIVE_ACTION_CHARACTERS
        ),

        componentNiin: getColumnValue(row, [
        "NIIN HOF",
        "NIIN",
        ]),

        componentDescription: getColumnValue(row, [
        "NIIN HOF Desc",
        "NIIN HOF Description",
        "Component Description",
        ]),

        cog: getColumnValue(row, ["COG"]),

        smrCode: getColumnValue(row, ["SMR Code"]),

        buSerNo: getColumnValue(row, [
        "Bu/SerNo",
        "BU/SERNO",
        "Bureau Serial Number",
        ]),

        repairNetPrice: toNumberOrUndefined(
        getColumnValue(row, ["Repair Net Price"])
        ),

        dlrCost: toNumberOrUndefined(
        getColumnValue(row, ["DLR Cost"])
        ),

        unitPrice: toNumberOrUndefined(
        getColumnValue(row, ["Unit Price"])
        ),

        manhours: toNumberOrUndefined(
        getColumnValue(row, ["Manhours", "Man Hours"])
        ),
    };

    if (!hasUsefulMaintenanceContent(fields)) {
        return null;
    }

    const text = buildRagText(fields);

    const id = buildRecordId(
        fields,
        sourceRow,
        usedIds
    );

    const metadata = removeEmptyMetadata({
        source: "deckplate-pull",
        sourceFile: "deckplate pull.xlsx",
        sourceSheet,
        sourceRow,

        tec: fields.tec,
        typeModelSeries: fields.typeModelSeries,
        actionOrgCode: fields.actionOrgCode,

        bcm: fields.bcm,
        rfiInd: fields.rfiInd,

        completedAt: fields.completedAt,
        lastAlteredAt: fields.lastAlteredAt,

        jcn: fields.jcn,
        mcn: fields.mcn,

        maintenanceLevel: fields.maintenanceLevel,
        maintenanceLevelDescription:
        fields.maintenanceLevelDescription,

        actionTakenCode: fields.actionTakenCode,

        malfunctionCode: fields.malfunctionCode,
        malfunctionDescription:
        fields.malfunctionDescription,
        malfunctionType: fields.malfunctionType,

        workCenterCode: fields.workCenterCode,

        componentNiin: fields.componentNiin,
        componentDescription:
        fields.componentDescription,

        cog: fields.cog,
        smrCode: fields.smrCode,
        buSerNo: fields.buSerNo,

        repairNetPrice: fields.repairNetPrice,
        dlrCost: fields.dlrCost,
        unitPrice: fields.unitPrice,
        manhours: fields.manhours,
    });

    return {
        id,
        text,
        metadata,
    };
    }

    async function main() {
    try {
        await fs.access(INPUT_FILE_PATH);
    } catch {
        throw new Error(
        [
            "Excel file not found.",
            `Expected path: ${INPUT_FILE_PATH}`,
            "",
            "Put the spreadsheet in server/data/",
            'and name it exactly: "deckplate pull.xlsx"',
        ].join("\n")
        );
    }

    const workbook = XLSX.readFile(INPUT_FILE_PATH, {
        cellDates: true,
    });

    const sourceSheet = workbook.SheetNames[0];

    if (!sourceSheet) {
        throw new Error(
        "No worksheet was found in the Excel workbook."
        );
    }

    const worksheet = workbook.Sheets[sourceSheet];

    const rows = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
        raw: false,
    });

    if (!rows.length) {
        throw new Error(
        "No data rows were found in the Excel worksheet."
        );
    }

    const headers = Object.keys(rows[0]);
    const getColumnValue = createColumnReader(headers);
    const usedIds = new Set();

    let skippedRows = 0;

    const records = rows
        .map((row, index) => {
        const sourceRow = index + 2;

        const record = buildRagRecord(
            row,
            sourceRow,
            sourceSheet,
            getColumnValue,
            usedIds
        );

        if (!record) {
            skippedRows += 1;
        }

        return record;
        })
        .filter(Boolean);

    if (!records.length) {
        throw new Error(
        [
            "No RAG records were created.",
            "The expected fields may not match the worksheet headers.",
            "",
            `Detected headers: ${headers.join(" | ")}`,
        ].join("\n")
        );
    }

    const jsonlOutput = records
        .map((record) => JSON.stringify(record))
        .join("\n");

    await fs.mkdir(path.dirname(OUTPUT_FILE_PATH), {
        recursive: true,
    });

    await fs.writeFile(
        OUTPUT_FILE_PATH,
        `${jsonlOutput}\n`,
        "utf8"
    );

    console.log("\nDeckplate RAG build complete.");
    console.log(`Worksheet: ${sourceSheet}`);
    console.log(`Excel rows read: ${rows.length}`);
    console.log(`Records created: ${records.length}`);
    console.log(`Rows skipped: ${skippedRows}`);
    console.log(`Output file: ${OUTPUT_FILE_PATH}`);

    console.log("\nDetected Excel headers:");
    console.log(headers.join(" | "));

    console.log("\nFirst generated RAG record:");
    console.log(JSON.stringify(records[0], null, 2));
}

main().catch((error) => {
    console.error("\nFailed to build Deckplate RAG data.");
    console.error(error.message);
    process.exit(1);
});