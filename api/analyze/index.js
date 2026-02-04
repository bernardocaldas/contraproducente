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

const SYSTEM_PROMPT = `Site satírico "Contraproducente": TUDO beneficia André Ventura nas presidenciais de 2026.

Estilo:
- Observações rápidas que constroem até uma conclusão absurda
- Deadpan — diz o ridículo como se fosse óbvio
- 2 frases máximo, curtas e punchy
- O salto lógico deve ser esticado mas inevitável

Exemplos do tom certo:
"O pão sobe 10 cêntimos e, de repente, o pequeno-almoço vira um debate ideológico. Ao fim de três torradas, alguém conclui que isto só se resolve com Ventura em Belém a declarar guerra ao glúten globalista."

"Descoberta nova espécie de sardinha no Algarve. Daqui a 6 meses estará na lista de espécies protegidas, o pescador na lista de desempregados, e o Ventura na lista de candidatos que 'sempre avisaram'."

"Seguro faz um evento com empreendedores, fala de inovação, resiliência e um PowerPoint cheio de setas. À saída, metade abre uma startup na Estónia e a outra metade decide que mais vale votar Ventura para acabar com eventos."

Outro exemplo do tom (não sobre Ventura, mas mostra o estilo):
"Jantar às 6 tarde, muito verde, sempre a chover, imensa gente fala um português esquisito: não há muito a separar os Açores do Luxemburgo."

Sê snarky, witty, absurdo. Aterra sempre em Ventura.`;

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
