import * as THREE from "three";
import React, { useCallback, useMemo } from "react";
import { ThreeEvent } from "@react-three/fiber";

import { HexCell, TerrainType } from "../../lib/HexCell";
import { HexCoordinates } from "../../lib/HexCoordinates";
import { HexGridTerrain } from "./HexGridTerrain";
import { HexGridWater } from "./HexGridWater";
import { HexGrid } from "../../lib/HexGrid";
import { PowerLines } from "../PowerSystem/PowerLines";
import { useGameStore } from "../../store/gameStore";
import { CornerCoordinates } from "../../lib/CornerCoordinates";
import { PLAYER_ID } from "../../store/constants";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { HexGridChunk as HexGridChunkType } from "../../lib/HexGridChunk";
import { Buildable } from "../Buildable";
import { PowerPole } from "../../lib/PowerSystem";
import { CoalPlant } from "../../lib/CoalPlant";

interface HexGridChunkProps {
  chunk: HexGridChunkType;
  grid: HexGrid;
  onCellClick: (coordinates: HexCoordinates) => void;
  debug?: boolean;
}

export const HexGridChunk = React.memo(function HexGridChunk({
  chunk,
  grid,
  onCellClick,
  debug = false,
}: HexGridChunkProps) {
  const buildMode = useGameStore((state) => state.players[PLAYER_ID].buildMode);
  const buildables = useGameStore((state) => state.buildables);
  const updateHexTerrain = useGameStore((state) => state.updateHexTerrain);
  const addBuildable = useGameStore((state) => state.addBuildable);

  const validCoordinates = useMemo(() => {
    return chunk.coordinates.filter((c): c is HexCoordinates => c !== null);
  }, [chunk.coordinates]);

  const ghostBuildable = useStoreWithEqualityFn(
    useGameStore,
    (state) => {
      const hoverLocation = state.players[PLAYER_ID].hoverLocation;
      if (!hoverLocation || !buildMode) return null;

      const point = new THREE.Vector3(
        hoverLocation.worldPoint[0],
        hoverLocation.worldPoint[1],
        hoverLocation.worldPoint[2]
      );

      if (buildMode.type === "power_pole") {
        const nearestCorner = HexCoordinates.getNearestCornerInChunk(
          point,
          validCoordinates
        );
        if (nearestCorner) {
          const ghostPole = new PowerPole("ghost", nearestCorner, true);
          // Create connections with existing power poles
          const otherPoles = buildables.filter(
            (b): b is PowerPole => b instanceof PowerPole
          );
          ghostPole.createConnections(otherPoles);
          return ghostPole;
        }
      } else if (buildMode.type === "coal_plant") {
        const coords = HexCoordinates.fromWorldPoint([point.x, point.y, point.z]);
        if (validCoordinates.some((c) => c.equals(coords))) {
          return new CoalPlant("ghost", coords, true);
        }
      }
      return null;
    },
    (a, b) => {
      if (!a && !b) return true;
      if (!a || !b) return false;
      if (a.type !== b.type) return false;
      if (a.coordinates && b.coordinates) {
        return a.coordinates.equals(b.coordinates);
      }
      if (a.cornerCoordinates && b.cornerCoordinates) {
        return a.cornerCoordinates.equals(b.cornerCoordinates);
      }
      return false;
    }
  );

  const setHoverLocation = useGameStore((state) => state.setHoverLocation);

  const handleHover = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const point = event.point;
      setHoverLocation(PLAYER_ID, [point.x, point.y, point.z]);
    },
    [setHoverLocation]
  );

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      const point = event.point.clone();
      const coords = HexCoordinates.fromWorldPoint([point.x, point.y, point.z]);
      const isValidCoord = validCoordinates.some((c) => c.equals(coords));

      if (!isValidCoord) return;

      if (buildMode?.type === "power_pole") {
        const nearestCorner = HexCoordinates.getNearestCornerInChunk(
          point,
          validCoordinates
        );
        if (nearestCorner) {
          addBuildable({
            type: "power_pole",
            cornerCoordinates: nearestCorner,
          });
        }
      } else if (buildMode?.type === "coal_plant") {
        addBuildable({
          type: "coal_plant",
          coordinates: coords,
        });
      } else {
        onCellClick(coords);
      }
    },
    [addBuildable, validCoordinates, buildMode, onCellClick]
  );

  const handleTerrainUpdate = useCallback(
    (coordinates: HexCoordinates, terrainType: TerrainType) => {
      updateHexTerrain(coordinates, terrainType);
    },
    [updateHexTerrain]
  );

  const cells = useMemo(() => {
    return validCoordinates
      .map((coordinates: HexCoordinates) => grid.getCell(coordinates))
      .filter((cell): cell is HexCell => cell !== null);
  }, [grid, validCoordinates]);

  // Filter buildables in this chunk
  const chunkBuildables = useMemo(() => {
    return buildables.filter((buildable) => {
      if (buildable.coordinates) {
        return validCoordinates.some((coord) =>
          coord.equals(buildable.coordinates!)
        );
      }
      if (buildable.cornerCoordinates) {
        return validCoordinates.some((coord) =>
          buildable.cornerCoordinates!.hex.equals(coord)
        );
      }
      return false;
    });
  }, [buildables, validCoordinates]);

  return (
    <group>
      <HexGridTerrain
        cells={cells}
        onClick={handleClick}
        onHover={handleHover}
        onUpdateTerrain={handleTerrainUpdate}
        debug={debug}
      />
      <HexGridWater cells={cells} grid={grid} />
      <PowerLines chunkCells={cells.map((cell: HexCell) => cell.coordinates)} />
      {chunkBuildables.map((buildable) => (
        <Buildable key={buildable.id} buildable={buildable} />
      ))}
      {ghostBuildable && <Buildable buildable={ghostBuildable} />}
    </group>
  );
});
