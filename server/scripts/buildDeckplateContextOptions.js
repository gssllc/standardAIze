const fs = require("node:fs/promises");
const path = require("node:path");

const INPUT_FILE_PATH = path.join(
    __dirname,
    "..",
    "data",
    "deckplate_records.jsonl"
);

const OUTPUT_FILE_PATH = path.join(
    __dirname,
    "..",
    "data",
    "deckplate_context_options.json"
);

/**
 * Converts values into trimmed strings and removes repeated whitespace.
 *
 * @param {unknown} value
 * @returns {string}
 */
function cleanText(value) {
    if (value === undefined || value === null) {
        return "";
    }

    return String(value)
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Creates the dependent-dropdown lookup key.
 *
 * @param {string} typeModelSeries
 * @param {string} tec
 * @returns {string}
 */
function createTypeModelSeriesTecKey(typeModelSeries, tec) {
    return `${typeModelSeries}||${tec}`;
}

/**
 * Converts a Set into an alphabetically sorted array.
 *
 * @param {Set<string>} values
 * @returns {string[]}
 */
function sortSet(values) {
    return [...values].sort((firstValue, secondValue) =>
        firstValue.localeCompare(secondValue, undefined, {
        numeric: true,
        sensitivity: "base",
        })
    );
}

/**
 * Converts a Map of Sets into a plain JSON object.
 *
 * @param {Map<string, Set<string>>} valuesByKey
 * @returns {Record<string, string[]>}
 */
function convertSetMapToObject(valuesByKey) {
    return Object.fromEntries(
        [...valuesByKey.entries()].map(([key, values]) => [
        key,
        sortSet(values),
        ])
    );
}

/**
 * Converts a Map of component Maps into a plain JSON object.
 *
 * @param {Map<string, Map<string, object>>} componentsByKey
 * @returns {Record<string, object[]>}
 */
function convertComponentMapToObject(componentsByKey) {
    return Object.fromEntries(
        [...componentsByKey.entries()].map(([key, components]) => {
        const sortedComponents = [...components.values()].sort(
            (firstComponent, secondComponent) => {
            return firstComponent.label.localeCompare(
                secondComponent.label,
                undefined,
                {
                numeric: true,
                sensitivity: "base",
                }
            );
            }
        );

        return [key, sortedComponents];
        })
    );
}

/**
 * Adds a value to a Set stored in a Map.
 *
 * @param {Map<string, Set<string>>} map
 * @param {string} key
 * @param {string} value
 */
function addValueToSetMap(map, key, value) {
    if (!key || !value) {
        return;
    }

    if (!map.has(key)) {
        map.set(key, new Set());
    }

    map.get(key).add(value);
    }

    async function main() {
    let fileContents;

    try {
        fileContents = await fs.readFile(INPUT_FILE_PATH, "utf8");
    } catch {
        throw new Error(
        [
            "Could not read deckplate_records.jsonl.",
            `Expected path: ${INPUT_FILE_PATH}`,
            "",
            "Run this first from the project root:",
            "npm run build:deckplate-rag",
        ].join("\n")
        );
    }

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

    if (!records.length) {
        throw new Error(
        "deckplate_records.jsonl does not contain any records."
        );
    }

    const typeModelSeriesSet = new Set();

    const tecsByTypeModelSeries = new Map();
    const componentsByTypeModelSeriesAndTec = new Map();
    const workCentersByTypeModelSeriesAndTec = new Map();
    const actionOrgsByTypeModelSeriesAndTec = new Map();

    for (const record of records) {
        const metadata = record.metadata || {};

        const typeModelSeries = cleanText(
        metadata.typeModelSeries
        );

        const tec = cleanText(metadata.tec);

        const componentNiin = cleanText(
        metadata.componentNiin
        );

        const componentDescription = cleanText(
        metadata.componentDescription
        );

        const workCenterCode = cleanText(
        metadata.workCenterCode
        );

        const actionOrgCode = cleanText(
        metadata.actionOrgCode
        );

        if (typeModelSeries) {
        typeModelSeriesSet.add(typeModelSeries);
        }

        /*
        The dependent fields need both a Type Model Series and a TEC.
        This prevents the UI from showing irrelevant combinations.
        */
        if (!typeModelSeries || !tec) {
        continue;
        }

        addValueToSetMap(
        tecsByTypeModelSeries,
        typeModelSeries,
        tec
        );

        const typeModelSeriesTecKey =
        createTypeModelSeriesTecKey(typeModelSeries, tec);

        addValueToSetMap(
        workCentersByTypeModelSeriesAndTec,
        typeModelSeriesTecKey,
        workCenterCode
        );

        addValueToSetMap(
        actionOrgsByTypeModelSeriesAndTec,
        typeModelSeriesTecKey,
        actionOrgCode
        );

        /*
        Component / NIIN dropdown options use NIIN as the selected value.
        We skip records with no NIIN because the backend will later use
        componentNiin as a Pinecone metadata filter.
        */
        if (!componentNiin) {
        continue;
        }

        if (
        !componentsByTypeModelSeriesAndTec.has(
            typeModelSeriesTecKey
        )
        ) {
        componentsByTypeModelSeriesAndTec.set(
            typeModelSeriesTecKey,
            new Map()
        );
        }

        const components =
        componentsByTypeModelSeriesAndTec.get(
            typeModelSeriesTecKey
        );

        if (!components.has(componentNiin)) {
        components.set(componentNiin, {
            value: componentNiin,
            label: componentDescription || componentNiin,
            componentNiin,
            componentDescription,
        });
        }
    }

    const contextOptions = {
        generatedAt: new Date().toISOString(),

        typeModelSeries: sortSet(typeModelSeriesSet),

        tecsByTypeModelSeries:
        convertSetMapToObject(tecsByTypeModelSeries),

        componentsByTypeModelSeriesAndTec:
        convertComponentMapToObject(
            componentsByTypeModelSeriesAndTec
        ),

        workCentersByTypeModelSeriesAndTec:
        convertSetMapToObject(
            workCentersByTypeModelSeriesAndTec
        ),

        actionOrgsByTypeModelSeriesAndTec:
        convertSetMapToObject(
            actionOrgsByTypeModelSeriesAndTec
        ),
    };

    await fs.writeFile(
        OUTPUT_FILE_PATH,
        `${JSON.stringify(contextOptions, null, 2)}\n`,
        "utf8"
    );

    console.log("\nDeckplate context options build complete.");
    console.log(`Source records read: ${records.length}`);
    console.log(
        `Type Model Series options: ${contextOptions.typeModelSeries.length}`
    );
    console.log(`Output file: ${OUTPUT_FILE_PATH}`);
}

main().catch((error) => {
    console.error("\nFailed to build Deckplate context options.");
    console.error(error.message);
    process.exit(1);
});