# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

frontend/
├── src/
│ ├── miniGame/
│ │ ├── assets/ # Sprites (tropas, inimigos, tiles)
│ │ ├── engine/ # Lógica do canvas e renderização
│ │ │ ├── GameLoop.js # Loop principal do jogo
│ │ │ ├── Renderer.js # Lógica de desenho isométrico
│ │ │ ├── InputHandler.js # Clique, teclado, etc
│ │ │ ├── CollisionManager.js # Colisões e interações
│ │ │ └── Pathfinding.js # Caminho dos inimigos (opcional)
│ │ ├── entities/
│ │ │ ├── Troop.js # Classe base de tropa
│ │ │ ├── Enemy.js # Classe base de inimigo
│ │ │ ├── Projectile.js # Projéteis disparados
│ │ │ └── Tile.js # Tiles do grid isométrico
│ │ ├── utils/
│ │ │ ├── IsoMath.js # Funções de projeção isométrica
│ │ │ └── constants.js # Tamanhos, limites, etc.
│ │ ├── GameCanvas.jsx # Componente React que renderiza o canvas
│ │ └── index.js # Entrada do jogo (setup inicial)
│ ├── pages/
│ │ └── TowerDefensePage.jsx # Página que exibe o minigame
