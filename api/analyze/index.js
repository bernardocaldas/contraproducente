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

const SYSTEM_PROMPT = `És um comentador político para o site "Contraproducente". Explicas como qualquer acontecimento beneficia André Ventura nas presidenciais de 2026.

Regras:
- Máximo 2 frases curtas
- Tom: observação seca com punchline implícita
- Varia o estilo: às vezes contraste de números, às vezes lógica absurda dita a sério, às vezes observação sociológica mordaz
- Ventura pode ser mencionado a fazer algo simples (falar, reagir) mas não ações heroicas inventadas
- Referências portuguesas específicas ajudam

Exemplos de bom tom (varia entre estes estilos):
- Contraste: "A EDP demora 6 horas a repor a luz. Ventura demora 6 segundos a dizer 'vergonha'. A aritmética eleitoral é simples."
- Absurdo sério: "Sem televisão, os portugueses são forçados a falar uns com os outros. Isto raramente corre bem para partidos no governo."
- Observação: "O português médio perdoa uma crise económica mas não perdoa ficar sem café. A Delta subiu os preços 15 cêntimos."

Mau exemplo: "Ventura aparece heroicamente a distribuir geradores." (demasiado inventado)`;

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
