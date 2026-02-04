# Contraproducente

*Análise política independente* — sátira que explica como qualquer acontecimento beneficia André Ventura.

## 🎯 Como funciona

1. Escreves um acontecimento qualquer ("Está a chover", "O Benfica perdeu", "Subiu o preço do pão")
2. A IA gera uma "análise" política séria explicando como isso beneficia Ventura
3. Partilhas no Twitter ou copias para onde quiseres

## 🛠 Tech Stack

- Frontend: HTML/CSS/JS vanilla
- Backend: Azure Functions (Node.js)
- AI: Azure OpenAI (GPT-5 Mini)
- Hosting: Azure Static Web Apps

## 🚀 Deploy

### Opção 1: Azure Static Web Apps (via GitHub Actions)

1. Cria um Static Web App no Azure Portal
2. Liga ao repo GitHub
3. Configura os Application Settings:
   - `AZURE_OPENAI_API_KEY`
   - `AZURE_OPENAI_ENDPOINT`
   - `AZURE_OPENAI_API_VERSION`
   - `AZURE_OPENAI_MODEL_NAME`

### Opção 2: Local

```bash
npm install
node server.js
```

## 📝 Licença

MIT — usa à vontade.

---

*Sátira política. Nenhuma análise é real.*
