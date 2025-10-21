# Colônia Gênesis

Simulação e tower-defense com gerenciamento de recursos em tema sci-fi. Frontend em React + Vite. Backend em Node/Express + MongoDB Atlas. Dados de jogo em JSON.

## Sumário
- [Visão geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Stack](#stack)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Instalação](#instalação)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Scripts](#scripts)
- [Fluxo de desenvolvimento](#fluxo-de-desenvolvimento)
- [Mecânicas principais](#mecânicas-principais)
- [Dados do jogo (JSON)](#dados-do-jogo-json)
- [API do backend](#api-do-backend)
- [Padrões de código](#padrões-de-código)
- [Testes](#testes)
- [Roadmap curto](#roadmap-curto)
- [Licença](#licença)

## Visão geral
- Objetivo: evoluir da colônia inicial até alta sustentabilidade e defesa total.
- Loop: turno de simulação → consumo/produção → eventos → defesa por ondas.
- Progresso: XP, moedas, itens, profissões, buffs/debuffs.

## Arquitetura
```
[React + Vite]  →  chama  →  [Node/Express API]  →  [MongoDB Atlas]
    ↑                                   ↑
  JSON locais (itens, cenários, missões) e estado de UI
```

## Stack
- Frontend: React, Vite, Tailwind, React Router.
- Backend: Node.js, Express, Mongoose.
- Banco: MongoDB Atlas.
- Outras libs: dayjs, dotenv.  

## Estrutura de pastas
```
colonia-genesis/
├── frontend/
│   ├── public/
│   └── src/
│       ├── assets/
│       ├── components/
│       │   ├── Login.jsx
│       │   ├── Sidebar.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Profile.jsx
│       │   ├── Status.jsx
│       │   ├── ParameterPanel.jsx
│       │   └── TowerDefensePage.jsx
│       ├── minigames/
│       │   └── explorador-fov/
│       │       ├── GameCanvas.jsx
│       │       ├── engine/
│       │       │   ├── CollisionManager.js
│       │       │   └── ... 
│       │       └── maps/
│       │           └── levels.json
│       ├── data/           # JSONs do jogo
│       │   ├── buildings.json
│       │   ├── items.json
│       │   ├── scenarios.json
│       │   └── missions.json
│       ├── pages/
│       │   └── Home.jsx
│       ├── services/
│       │   ├── api.js
│       │   └── coloniaService.js
│       ├── hooks/
│       │   ├── useWaterTicker.js
│       │   └── useMainTour.js
│       ├── App.jsx
│       ├── main.jsx
│       └── styles/
│           ├── App.css
│           └── Sidebar.css
├── backend/
│   ├── src/
│   │   ├── db.js
│   │   ├── models/
│   │   │   ├── Character.js
│   │   │   └── User.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   └── characterController.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   └── character.routes.js
│   │   └── server.js
│   └── package.json
├── README.md
└── package.json
```

## Instalação
```bash
# clonar
git clone https://github.com/<seu-usuario>/colonia-genesis.git
cd colonia-genesis

# backend
cd backend
cp .env.example .env
npm install

# frontend
cd ../frontend
cp .env.example .env
npm install
```

## Variáveis de ambiente
`backend/.env`
```
PORT=4000
MONGO_URI="mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority"
JWT_SECRET="troque-este-valor"
```

`frontend/.env`
```
VITE_API_BASE_URL="http://localhost:4000"
```

## Scripts
Backend:
```bash
cd backend
npm run dev    # nodemon
npm start      # produção
```
Frontend:
```bash
cd frontend
npm run dev    # Vite
npm run build
npm run preview
```

## Fluxo de desenvolvimento
1. Subir API (`backend`).
2. Subir UI (`frontend`).
3. Popular JSONs em `frontend/src/data/`.
4. Criar usuário e personagem via UI.
5. Rodar defesa e simulação. Validar consumo/produção e ondas.

## Mecânicas principais
- Recursos: água, comida, energia, minerais.
- Personagem: HP e Stamina caem em atividades. Recuperam a cada 1 min em tempo real para todos os personagens.
- Profissões/Trabalhos: ferreiro, carpinteiro, bardo, artista, roubo, assassino. Afetam stamina, XP e moedas.
- Itens: inventário baseado em contagem por id.
- Missões (storytelling): três escolhas por cenário. Cada escolha contém três eventos aleatórios
  (penalidade, recompensa, neutro). Consumo de stamina variável.
- Tower-Defense: ondas, tipos de inimigos, cadência, dano, alcance, buffs (ex.: `slowFactor`).

## Dados do jogo (JSON)

### `missions.json` (exemplo)
```json
{
  "fase_01": {
    "id": "fase_01",
    "nome": "Perímetro Leste",
    "intervalBetweenWavesMs": 25000,
    "defaultSpawnCadence": 150,
    "waves": [
      { "enemies": [ { "type": "medu", "count": 1 } ] }
    ]
  }
}
```

### `scenarios.json` (estrutura recomendada)
```json
{
  "guardiao": {
    "id": "guardiao",
    "nome": "Guardião",
    "cenarios": [
      {
        "id": 1,
        "descricao": "Descrição genérica do cenário.",
        "opcoes": [
          {
            "id": "A",
            "custoStamina": { "min": 2, "max": 5 },
            "eventos": {
              "penalidade": { "xp": -5, "moedas": -10 },
              "recompensa": { "xp": 10, "moedas": 20 },
              "neutro": {}
            }
          },
          { "id": "B", "custoStamina": { "min": 1, "max": 3 }, "eventos": { "penalidade": {}, "recompensa": {}, "neutro": {} } },
          { "id": "C", "custoStamina": { "min": 3, "max": 6 }, "eventos": { "penalidade": {}, "recompensa": {}, "neutro": {} } }
        ]
      }
    ]
  }
}
```

### `items.json` (exemplo)
```json
[
  { "id": "agua", "nome": "Água", "descricao": "Recurso hídrico.", "efeitos": { "stamina": 2 } },
  { "id": "kitMedico", "nome": "Kit Médico", "descricao": "Cura leve.", "efeitos": { "hp": 10 } }
]
```

### `buildings.json` (exemplo)
```json
[
  { "id": "usina", "nome": "Usina", "custo": { "minerais": 50 }, "producao": { "energia": 5 } },
  { "id": "fazenda", "nome": "Fazenda", "custo": { "minerais": 30 }, "producao": { "comida": 3 } }
]
```

## API do backend

### Autenticação
- `POST /auth/register` → `{ email, password }`
- `POST /auth/login` → `{ email, password }` retorna `{ token }`

### Personagem
- `GET /character/me` → status e inventário.
- `POST /character` → cria personagem inicial.
- `PUT /character/apply-effect` → aplica efeitos de atividades, missões e buffs.
- `GET /character/mission/next` → dados da próxima missão via `getNextMissionId`.

### Erros e fluxos
- Se `GET /character/status` retornar 500 na Home, renderizar tela de cadastro com campos Nome e atributos.  
- Recuperação HP/Stamina: job em intervalo real de 1 min no servidor.

## Padrões de código
- Type-safe onde possível. Evitar estados globais opacos.
- Separar “engine” de UI (ex.: colisão, projéteis, IA).
- Reset de projéteis na criação para evitar “vazamento” de efeitos:
  - Definir `p.tipo`, `p.dano`, `p.vx/vy`, `p.bounds`, `p.row`, `p.tileH`.
  - Garantir que `slowFactor` é local ao projétil, não global.

## Testes
- Unitários: lógica de simulação, buffs, economia.
- Integração: rotas de personagem e autenticação.
- UI: smoke tests de páginas principais.

## Roadmap curto
- Missão “Guardião” com 40 cenários. Batalha contra dragão antes do 40.
- Tela de carga de até 8 itens antes da missão e lista de transferência.
- Comércio unificado em `CommerceDetail.js` com opções Mercado e Taverneiro.
- Balanceamento de tropas: shotgun 3 fileiras, bazuca teleguiada, lança-chamas curto alcance.

## Licença
Defina a licença do projeto (MIT recomendado).
