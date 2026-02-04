const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');

const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || 'https://ai-bernardo-6946.openai.azure.com';
const AZURE_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
const AZURE_MODEL = process.env.AZURE_OPENAI_MODEL_NAME || 'gpt-5-mini';
const AZURE_URL = `${AZURE_ENDPOINT}/openai/deployments/${AZURE_MODEL}/chat/completions?api-version=${AZURE_API_VERSION}`;

// Table Storage
const STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT;
const STORAGE_KEY = process.env.AZURE_STORAGE_KEY;
const TABLE_NAME = 'analyses';

let tableClient = null;
if (STORAGE_ACCOUNT && STORAGE_KEY) {
    const credential = new AzureNamedKeyCredential(STORAGE_ACCOUNT, STORAGE_KEY);
    tableClient = new TableClient(
        `https://${STORAGE_ACCOUNT}.table.core.windows.net`,
        TABLE_NAME,
        credential
    );
}

const SYSTEM_PROMPT = `Site "Contraproducente": análise política satírica que explica como qualquer acontecimento beneficia André Ventura nas presidenciais de 2026.

Tom: comentador político a sério, mas a lógica tem um salto absurdo. A frase deve terminar sempre com a conclusão de que beneficia Ventura.

- Máximo 2-3 frases
- Parece análise política credível até reparares no absurdo
- A conclusão deve aterrar em Ventura de forma inesperada mas inevitável
- Seco, espirituoso, ligeiramente fatalista

EXEMPLOS DO TOM CERTO:

"Quando a EDP demora 6 horas a repor a luz, o português médio tem tempo para contemplar a vela e pensar 'se calhar o problema é mesmo estrutural'. Estrutural é a palavra favorita de quem vai votar Ventura mas ainda não sabe."

"Os bilhetes para a Taylor Swift esgotam em 4 minutos. O português que ficou de fora descobre que o sistema está contra ele — primeiro nos bilhetes, depois na habitação, eventualmente nas urnas."

"Descoberta nova espécie de sardinha no Algarve. Daqui a 6 meses estará na lista de espécies protegidas, o pescador na lista de desempregados, e o Ventura na lista de candidatos que 'sempre avisaram'."

"Uma humilhação destas cria 2 milhões de pessoas à procura de culpados. O Ventura nem precisa de apontar — basta estar disponível."

Segue este tom exacto.`;

async function saveAnalysis(event, analysis) {
    if (!tableClient) return;
    try {
        const timestamp = Date.now();
        await tableClient.createEntity({
            partitionKey: 'analysis',
            rowKey: `${9999999999999 - timestamp}`,
            event,
            analysis,
            createdAt: new Date().toISOString()
        });
    } catch (err) {
        console.error('Failed to save:', err.message);
    }
}

module.exports = async function (context, req) {
    const event = req.body?.event;
    
    if (!event || typeof event !== 'string') {
        context.res = { status: 400, body: { error: 'Event is required' } };
        return;
    }

    try {
        const response = await fetch(AZURE_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'api-key': AZURE_API_KEY
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: `Acontecimento: ${event}\n\nExplica como isto beneficia André Ventura.` }
                ],
                max_completion_tokens: 2000
            })
        });

        if (!response.ok) {
            throw new Error('Azure OpenAI API error');
        }

        const data = await response.json();
        let analysis = data.choices?.[0]?.message?.content || 'Não foi possível gerar análise.';
        analysis = analysis.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
        
        // Save non-blocking
        saveAnalysis(event, analysis);
        
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { analysis }
        };
    } catch (error) {
        context.log('API Error:', error);
        context.res = { status: 500, body: { error: 'Failed to generate analysis' } };
    }
};
