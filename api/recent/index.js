const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');

const STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT;
const STORAGE_KEY = process.env.AZURE_STORAGE_KEY;
const TABLE_NAME = 'analyses';

module.exports = async function (context, req) {
    if (!STORAGE_ACCOUNT || !STORAGE_KEY) {
        context.res = { status: 200, body: { analyses: [] } };
        return;
    }

    try {
        const credential = new AzureNamedKeyCredential(STORAGE_ACCOUNT, STORAGE_KEY);
        const tableClient = new TableClient(
            `https://${STORAGE_ACCOUNT}.table.core.windows.net`,
            TABLE_NAME,
            credential
        );

        const analyses = [];
        const entities = tableClient.listEntities({
            queryOptions: { filter: "PartitionKey eq 'analysis'" }
        });
        
        for await (const entity of entities) {
            analyses.push({
                event: entity.event,
                analysis: entity.analysis,
                createdAt: entity.createdAt
            });
            if (analyses.length >= 10) break;
        }

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { analyses }
        };
    } catch (err) {
        context.log('Error fetching recent:', err.message);
        context.res = { status: 200, body: { analyses: [] } };
    }
};
