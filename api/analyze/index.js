const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || 'https://ai-bernardo-6946.openai.azure.com';
const AZURE_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
const AZURE_MODEL = process.env.AZURE_OPENAI_MODEL_NAME || 'gpt-5-mini';

const AZURE_URL = `${AZURE_ENDPOINT}/openai/deployments/${AZURE_MODEL}/chat/completions?api-version=${AZURE_API_VERSION}`;

const SYSTEM_PROMPT = `És um comentador político português. Explicas como QUALQUER acontecimento beneficia André Ventura nas presidenciais de 2026.

Tom: seco, professoral, condescendente. Usa jargão político ("eleitorado", "base de apoio", "narrativa", "franjas de descontentes").

Regras:
- Máximo 2 frases curtas
- Parece plausível mas é absurdo
- Conclui sempre que beneficia Ventura
- Responde APENAS em português europeu
- Sem introduções, só a análise

Exemplo: "Naturalmente, qualquer subida do preço do pão reforça a narrativa de descontentamento que Ventura capitaliza junto das franjas mais vulneráveis do eleitorado."`;

module.exports = async function (context, req) {
    const event = req.body?.event;
    
    if (!event || typeof event !== 'string') {
        context.res = {
            status: 400,
            body: { error: 'Event is required' }
        };
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
                max_completion_tokens: 1000
            })
        });

        if (!response.ok) {
            const error = await response.text();
            context.log('Azure OpenAI Error:', error);
            throw new Error('Azure OpenAI API error');
        }

        const data = await response.json();
        let analysis = data.choices?.[0]?.message?.content || 'Não foi possível gerar análise.';
        
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { analysis }
        };
    } catch (error) {
        context.log('API Error:', error);
        context.res = {
            status: 500,
            body: { error: 'Failed to generate analysis' }
        };
    }
};
