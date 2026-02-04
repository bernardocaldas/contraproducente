import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { TableClient, AzureNamedKeyCredential } from '@azure/data-tables';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// Azure OpenAI config
const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
const AZURE_MODEL = process.env.AZURE_OPENAI_MODEL_NAME || 'gpt-5-mini';
const AZURE_URL = `${AZURE_ENDPOINT}/openai/deployments/${AZURE_MODEL}/chat/completions?api-version=${AZURE_API_VERSION}`;

// Azure Table Storage config
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
    // Create table if not exists
    tableClient.createTable().catch(() => {}); // Ignore if exists
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

// Save analysis to Table Storage
async function saveAnalysis(event, analysis) {
    if (!tableClient) return;
    try {
        const timestamp = Date.now();
        await tableClient.createEntity({
            partitionKey: 'analysis',
            rowKey: `${9999999999999 - timestamp}`, // Reverse for newest first
            event,
            analysis,
            createdAt: new Date().toISOString()
        });
    } catch (err) {
        console.error('Failed to save analysis:', err.message);
    }
}

// Get recent analyses
async function getRecentAnalyses(limit = 10) {
    if (!tableClient) return [];
    try {
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
            if (analyses.length >= limit) break;
        }
        return analyses;
    } catch (err) {
        console.error('Failed to get analyses:', err.message);
        return [];
    }
}

app.post('/api/analyze', async (req, res) => {
    const { event } = req.body;
    
    if (!event || typeof event !== 'string') {
        return res.status(400).json({ error: 'Event is required' });
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
            const error = await response.text();
            console.error('Azure OpenAI Error:', error);
            throw new Error('Azure OpenAI API error');
        }

        const data = await response.json();
        let analysis = data.choices?.[0]?.message?.content || 'Não foi possível gerar análise.';
        
        // Clean up any artifacts
        analysis = analysis.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
        analysis = analysis.replace(/^[\s\S]*?<\/think>\s*/g, '').trim();
        
        // Save to storage (non-blocking)
        saveAnalysis(event, analysis);
        
        res.json({ analysis });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Failed to generate analysis' });
    }
});

app.get('/api/recent', async (req, res) => {
    const analyses = await getRecentAnalyses(10);
    res.json({ analyses });
});

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Contraproducente running at http://localhost:${port}`);
});
