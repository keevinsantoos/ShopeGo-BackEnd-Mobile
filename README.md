# ShopeGo Back-End Mobile

API REST e regras de negócio do marketplace **ShopGo**, projetada para integrar com o aplicativo **ShopeGo-FrontEnd-Mobile** via **Firebase Admin SDK (Auth + Firestore)** e gateway de pagamento (**Mercado Pago** com fallback **Mock** para desenvolvimento local).

## Stack

- **Node.js + TypeScript** (`strict: true`)
- **Fastify** + `@fastify/cors`
- **Zod** (validação de env, entrada e schemas compatíveis com o Front-end)
- **Firebase Admin SDK** (`firebase-admin` — Auth + Firestore)
- **Mercado Pago API v1** (Pix / Boleto + Webhook) e `MockPaymentProvider`
- **Vitest** (testes unitários das regras de negócio)

## Estrutura de Pastas

```text
src/
├── app.ts                        # Configuração do Fastify, CORS e tratamento global de erros
├── server.ts                     # Ponto de entrada HTTP
├── config/
│   ├── env.ts                    # Validação de variáveis de ambiente com Zod
│   └── firebase.ts               # Singleton do Firebase Admin SDK
├── middlewares/
│   └── auth.middleware.ts        # Validação do Bearer idToken do Firebase Auth
├── shared/
│   ├── errors/app-error.ts       # Erros HTTP tipados
│   └── utils/pricing.ts          # Cálculo de descontos, frete e total do checkout
└── modules/
    ├── health/                   # GET /health
    ├── products/                 # Catálogo, filtros e seed no Firestore
    ├── orders/                   # Checkout atômico, estoque, máquina de estados e tracking
    └── payments/                 # Provider Pattern (Mercado Pago + Mock) e Webhook
```

## Como Rodar

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Copie o `.env.example` para `.env` e configure as credenciais do Firebase Admin (`service-account.json` ou variáveis individuais):
   ```bash
   cp .env.example .env
   ```
3. Inicie em modo desenvolvimento:
   ```bash
   npm run dev
   ```
4. Verifique tipos e rode os testes:
   ```bash
   npm run typecheck
   npm test
   ```

## Principais Endpoints

| Método | Rota | Auth | Descrição |
| :--- | :--- | :---: | :--- |
| `GET` | `/health` | Pública | Status da API e provider de pagamento ativo |
| `GET` | `/products` | Pública | Lista produtos (`?search=`, `?category=`, `?onlyOffers=true`) |
| `GET` | `/products/:id` | Pública | Detalhes de um produto |
| `POST` | `/products/seed` | Bearer | Popula o Firestore com os produtos iniciais |
| `POST` | `/orders` | Bearer | Checkout: valida estoque em transação, calcula preço/frete e gera pagamento |
| `GET` | `/orders` | Bearer | Lista os pedidos do usuário autenticado |
| `GET` | `/orders/:id` | Bearer | Detalhes de um pedido do usuário |
| `GET` | `/orders/:id/tracking` | Bearer | Timeline de rastreamento do pedido |
| `PATCH` | `/orders/:id/cancel` | Bearer | Cancela pedido (`pending`/`confirmed`) e devolve estoque |
| `PATCH` | `/orders/:id/status` | Bearer | Atualiza status respeitando a máquina de estados |
| `POST` | `/payments/webhook` | Pública | Webhook de confirmação do Mercado Pago |
| `POST` | `/payments/simulate/:orderId` | Bearer | Simula aprovação/recusa quando `PAYMENT_PROVIDER=mock` |
