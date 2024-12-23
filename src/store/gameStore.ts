import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { devtools } from "zustand/middleware";
import { WritableDraft } from "immer";
import { z } from "zod";
import { nanoid } from "nanoid";

import { HexGrid, HexGridSchema, type HexGridData } from "../lib/HexGrid";
import { MapData } from "../lib/MapData";
import { HexCell } from "../lib/HexCell";
import { HexCoordinates } from "../lib/HexCoordinates";
import { PowerPole } from "../lib/PowerSystem";
import { HexDirection } from "../lib/HexMetrics";
import { CornerCoordinates } from "../lib/CornerCoordinates";

interface Player {
  money: number;
  isBuildMode: boolean;
  hoverLocation: {
    worldPoint: [number, number, number];
  } | null;
}

interface GameState {
  isDebug: boolean;
  hexGrid: HexGrid;
  powerPoles: PowerPole[];
  players: {
    [playerId: string]: Player;
  };
}

type Setter = (
  state: (state: WritableDraft<GameState>) => void,
  shouldReplace?: false,
  name?: string
) => void;

// Actions

type Actions = {
  makeNewHexGridFromMapData: (mapData: MapData) => void;
  setIsDebug: (isDebug: boolean) => void;
  exportHexGridToJSON: () => string;
  importHexGridFromJSON: (jsonString: string) => void;
  addPowerPole: (corner: CornerCoordinates) => void;
  setMoney: (playerId: string, amount: number) => void;
  spendMoney: (playerId: string, amount: number) => boolean;
  setBuildMode: (playerId: string, enabled: boolean) => void;
  setHoverLocation: (
    playerId: string,
    worldPoint: [number, number, number] | null
  ) => void;
};

const makeNewHexGridFromMapData = (set: Setter) => (mapData: MapData) => {
  set(
    (state) => {
      state.hexGrid = new HexGrid(100, 60);
      state.hexGrid.constructFromMapData(mapData);
    },
    undefined,
    "makeNewHexGridFromMapData"
  );
};

const setIsDebug = (set: Setter) => (isDebug: boolean) => {
  set(
    (state) => {
      state.isDebug = isDebug;
    },
    undefined,
    "setIsDebug"
  );
};

const exportHexGridToJSON = (set: Setter) => (): string => {
  const state = useGameStore.getState();
  const exportData: HexGridData = {
    width: state.hexGrid.width,
    height: state.hexGrid.height,
    cells: state.hexGrid.cells.map((cell) => ({
      coordinates: {
        x: cell.coordinates.x,
        z: cell.coordinates.z,
      },
      elevation: cell.elevation,
      waterLevel: cell.waterLevel,
      stateInfo: cell.stateInfo,
    })),
  };
  return JSON.stringify(exportData, null, 2);
};

const importHexGridFromJSON = (set: Setter) => (jsonString: string) => {
  try {
    const data = JSON.parse(jsonString);
    const validatedData = HexGridSchema.parse(data);

    set(
      (state) => {
        state.hexGrid = new HexGrid(validatedData.width, validatedData.height);
        validatedData.cells.forEach((cellData) => {
          const cell = new HexCell(
            cellData.coordinates.x,
            cellData.coordinates.z
          );
          cell.elevation = cellData.elevation;
          cell.waterLevel = cellData.waterLevel;
          cell.stateInfo = cellData.stateInfo;
          state.hexGrid.addCell(
            cell,
            cellData.coordinates.x,
            cellData.coordinates.z
          );
        });
      },
      undefined,
      "importHexGridFromJSON"
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Invalid HexGrid data:", error.errors);
    }
    throw error;
  }
};

const setMoney = (set: Setter) => (playerId: string, amount: number) => {
  set(
    (state) => {
      if (state.players[playerId]) {
        state.players[playerId].money = amount;
      }
    },
    undefined,
    "setMoney"
  );
};

const spendMoney =
  (set: Setter) =>
  (playerId: string, amount: number): boolean => {
    let success = false;
    set(
      (state) => {
        const player = state.players[playerId];
        if (player && player.money >= amount) {
          player.money -= amount;
          success = true;
        }
      },
      undefined,
      "spendMoney"
    );
    return success;
  };

const setBuildMode = (set: Setter) => (playerId: string, enabled: boolean) => {
  set(
    (state) => {
      if (state.players[playerId]) {
        state.players[playerId].isBuildMode = enabled;
        if (!enabled) {
          state.players[playerId].hoverLocation = null;
        }
      }
    },
    undefined,
    "setBuildMode"
  );
};

const setHoverLocation =
  (set: Setter) =>
  (playerId: string, worldPoint: [number, number, number] | null) => {
    set(
      (state) => {
        if (state.players[playerId]) {
          state.players[playerId].hoverLocation = worldPoint
            ? { worldPoint }
            : null;
        }
      },
      undefined,
      "setHoverLocation"
    );
  };

const addPowerPole = (set: Setter) => (corner: CornerCoordinates) => {
  let success = false;
  set(
    (state) => {
      const existingPole = state.powerPoles.find((p) =>
        p.cornerCoordinates.equals(corner)
      );

      // For now, just use the first player
      const playerId = Object.keys(state.players)[0];
      const player = state.players[playerId];

      if (!existingPole && player && player.money >= 1) {
        const id = nanoid(6);
        const newPole = new PowerPole(id, corner);
        newPole.createConnections(state.powerPoles);
        state.powerPoles.push(newPole);
        player.money -= 1;
        success = true;
      }
    },
    undefined,
    "addPowerPole"
  );
  return success;
};

export const useGameStore = create<GameState & Actions>()(
  devtools(
    immer((set) => ({
      isDebug: false,
      hexGrid: new HexGrid(10, 10),
      powerPoles: [],
      players: {
        player1: {
          money: 10,
          isBuildMode: false,
          hoverLocation: null,
        },
      },

      makeNewHexGridFromMapData: makeNewHexGridFromMapData(set),
      setIsDebug: setIsDebug(set),
      exportHexGridToJSON: exportHexGridToJSON(set),
      importHexGridFromJSON: importHexGridFromJSON(set),
      addPowerPole: addPowerPole(set),
      setMoney: setMoney(set),
      spendMoney: spendMoney(set),
      setBuildMode: setBuildMode(set),
      setHoverLocation: setHoverLocation(set),
    }))
  )
);
