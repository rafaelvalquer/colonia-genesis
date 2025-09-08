export const totalRows = 7;
export const totalCols = 12;

export const combatStartRow = 1;
export const combatEndRow = 5;
export const combatStartCol = 1;
export const combatEndCol = 10;

export const groundMap = [
  [
    "tetoE",
    "teto",
    "teto",
    "teto",
    "teto",
    "teto",
    "teto",
    "teto",
    "teto",
    "teto",
    "teto",
    "tetoD",
  ],
  [
    "CantoE",
    "centro1",
    "centro2",
    "centro1",
    "centro2",
    "centro1",
    "centro2",
    "centro1",
    "centro2",
    "centro1",
    "centro2",
    "CantoD",
  ],
  [
    "CantoE",
    "centro2",
    "centro1",
    "centro2",
    "centro1",
    "centro2",
    "centro1",
    "centro2",
    "centro1",
    "centro2",
    "centro1",
    "CantoD",
  ],
  [
    "CantoE",
    "centro1",
    "centro2",
    "centro1",
    "centro2",
    "centro1",
    "centro2",
    "centro1",
    "centro2",
    "centro1",
    "centro2",
    "CantoD",
  ],
  [
    "CantoE",
    "centro2",
    "centro1",
    "centro2",
    "centro1",
    "centro2",
    "centro1",
    "centro2",
    "centro1",
    "centro2",
    "centro1",
    "CantoD",
  ],
  [
    "CantoE",
    "centro1",
    "centro2",
    "centro1",
    "centro2",
    "centro1",
    "centro2",
    "centro1",
    "centro2",
    "centro1",
    "centro2",
    "CantoD",
  ],
  [
    "chaoE",
    "chao",
    "chao",
    "chao",
    "chao",
    "chao",
    "chao",
    "chao",
    "chao",
    "chao",
    "chao",
    "chaoD",
  ],
];

export function estaNaAreaDeCombate(row, col) {
  return (
    row >= combatStartRow &&
    row <= combatEndRow &&
    col >= combatStartCol &&
    col <= combatEndCol
  );
}
