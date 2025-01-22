import React, { useCallback, useMemo } from "react";
import { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { debounce } from "lodash";

import {
  coordinatesToString,
  fromWorldPoint,
  HexCoordinates,
} from "@/lib/coordinates/HexCoordinates";
import {
  HexCell,
  Population,
  getColor,
  getCenterPoint,
  isUnderwater,
} from "@/lib/HexCell";
import { HexMesh } from "@/lib/HexMesh";
import { HexMetrics } from "@/lib/HexMetrics";
import { useClientStore } from "@/lib/clientState";

interface HexGridTerrainProps {
  cells: HexCell[];
  onClick: (event: ThreeEvent<MouseEvent | PointerEvent>) => void;
  onHover: (event: ThreeEvent<PointerEvent>) => void;
  onUpdateCell?: (
    coordinates: HexCoordinates,
    updates: Partial<HexCell>
  ) => void;
  debug?: boolean;
}

export const HexGridTerrain = React.memo(function HexGridTerrain({
  cells,
  onClick,
  onHover,
  onUpdateCell,
  debug = false,
}: HexGridTerrainProps) {
  const isPaintbrushMode = useClientStore(
    (state) => state.mapBuilder.isPaintbrushMode
  );
  const selectedTerrainType = useClientStore(
    (state) => state.mapBuilder.selectedTerrainType
  );
  const selectedPopulation = useClientStore(
    (state) => state.mapBuilder.selectedPopulation
  );

  const debouncedOnHover = useMemo(
    () => debounce(onHover, 50, { maxWait: 50 }),
    [onHover]
  );

  React.useEffect(() => {
    return () => {
      if (debouncedOnHover) {
        debouncedOnHover.cancel();
      }
    };
  }, [debouncedOnHover]);

  const paintCell = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (
        isPaintbrushMode &&
        (selectedTerrainType || selectedPopulation !== null) &&
        onUpdateCell
      ) {
        // Get intersection point from the event
        const point = event.point;
        const hexCoords = fromWorldPoint([point.x, point.y, point.z]);

        const updates: Partial<HexCell> = {};
        if (selectedTerrainType) {
          updates.terrainType = selectedTerrainType;
        }
        if (selectedPopulation !== null) {
          updates.population = selectedPopulation;
        }

        onUpdateCell(hexCoords, updates);
        event.stopPropagation();
      }
    },
    [isPaintbrushMode, selectedTerrainType, selectedPopulation, onUpdateCell]
  );

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (
        isPaintbrushMode &&
        (selectedTerrainType || selectedPopulation !== null)
      ) {
        paintCell(event);
      } else {
        onClick(event);
      }
    },
    [
      onClick,
      paintCell,
      isPaintbrushMode,
      selectedTerrainType,
      selectedPopulation,
    ]
  );

  const { terrainGeometry } = useMemo(() => {
    const hexMesh = new HexMesh();
    cells.forEach((cell) => {
      const center = getCenterPoint(cell);
      const color = getColor(cell);
      for (let d = 0; d < 6; d++) {
        if (!isUnderwater(cell)) {
          hexMesh.addTriangle(
            center,
            HexMetrics.getFirstCorner(center, d),
            HexMetrics.getSecondCorner(center, d),
            color
          );
        }
      }
    });

    const terrainGeometry = new THREE.BufferGeometry();
    terrainGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(hexMesh.vertices, 3)
    );
    terrainGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(hexMesh.colors, 3)
    );
    terrainGeometry.setIndex(hexMesh.indices);
    terrainGeometry.computeVertexNormals();

    return { terrainGeometry };
  }, [cells]);

  return (
    <mesh
      geometry={terrainGeometry}
      onClick={handleClick}
      onPointerMove={debouncedOnHover}
    >
      <meshStandardMaterial
        vertexColors
        side={THREE.DoubleSide}
        metalness={0.0}
        roughness={0.8}
      />
      {debug &&
        cells.map((cell) => {
          const [x, y, z] = getCenterPoint(cell);
          return (
            <Text
              key={coordinatesToString(cell.coordinates)}
              position={[x, y + 0.1, z]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.2}
              color="black"
            >
              {`${coordinatesToString(cell.coordinates)}${
                cell.population !== Population.Unpopulated
                  ? `\n${Population[cell.population]}`
                  : ""
              }`}
            </Text>
          );
        })}
    </mesh>
  );
});