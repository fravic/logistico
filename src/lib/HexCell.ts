import { immerable } from "immer";
import { Color, HSL } from "three";
import { z } from "zod";

import { HexCoordinates, HexCoordinatesSchema, Vertex } from "./HexCoordinates";
import { HexMetrics } from "./HexMetrics";
import { StateInfo } from "./MapData";

const BASE_GREEN = new Color(0xc9eba1); // Light green base color

export const HexCellSchema = z.object({
  coordinates: HexCoordinatesSchema,
  elevation: z.number(),
  waterLevel: z.number(),
  stateInfo: z
    .object({
      name: z.string(),
      id: z.string(),
    })
    .nullable(),
});

export type HexCellData = z.infer<typeof HexCellSchema>;

export class HexCell {
  [immerable] = true;

  coordinates: HexCoordinates;
  elevation: number = 0;
  waterLevel: number = 0;
  stateInfo: StateInfo | null = null;

  constructor(x: number, z: number, stateInfo: StateInfo | null = null) {
    this.coordinates = new HexCoordinates(x, z);
    this.stateInfo = stateInfo;

    if (!stateInfo) {
      this.elevation = -0.2;
      this.waterLevel = 0;
    }
  }

  get isUnderwater(): boolean {
    return this.waterLevel > this.elevation;
  }

  stateHash(): number {
    return Array.from(this.stateInfo?.name ?? "").reduce(
      (acc, char) => char.charCodeAt(0) + ((acc << 5) - acc),
      0
    );
  }

  color(): Color {
    const color = BASE_GREEN.clone();

    if (this.stateInfo?.name) {
      const hsl: HSL = { h: 0, s: 0, l: 0 };
      color.getHSL(hsl);
      hsl.s = 0.8;
      // Vary lightness slightly based on state hash
      hsl.l = Math.max(
        0.4,
        Math.min(0.9, hsl.l + ((this.stateHash() % 40) - 20) / 100)
      );
      color.setHSL(hsl.h, hsl.s, hsl.l);
    }

    return color;
  }

  centerPoint(): Vertex {
    const vertex = this.coordinates.toWorldPoint();
    return [vertex[0], this.elevation, vertex[2]];
  }

  waterCenterPoint(): Vertex {
    return [this.centerPoint()[0], this.waterLevel, this.centerPoint()[2]];
  }
}
