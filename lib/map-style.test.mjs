// The map must show KurdBooking's shops and nothing else: no cafes, hotels, gyms, bus stops or any
// other business or icon from the base map. Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAP_AREA, inMapArea } from "./map-area.ts";

const style = JSON.parse(readFileSync(new URL("../components/map/style.json", import.meta.url), "utf8"));
const layoutOf = (l) => Object.keys(l.layout ?? {});

test("the base map has no business or point-of-interest layers", () => {
  const poi = style.layers.filter((l) => l["source-layer"] === "poi" || /(^|[_-])poi([_-]|$)/i.test(l.id)); // not «…_point_label»
  assert.deepEqual(poi.map((l) => l.id), []);
});

test("the base map draws no icons at all (shops, shields, airports …)", () => {
  assert.equal(style.sprite, undefined, "no sprite sheet means no icons can be drawn");
  const withIcons = style.layers.filter((l) => layoutOf(l).some((k) => k.startsWith("icon-")));
  assert.deepEqual(withIcons.map((l) => l.id), []);
  assert.deepEqual(style.layers.filter((l) => /shield|airport/.test(l.id)).map((l) => l.id), []);
});

test("only the street-map vector source is used", () => {
  assert.deepEqual(Object.keys(style.sources), ["openmaptiles"]);
  assert.ok(style.layers.every((l) => l.type === "background" || l.source === "openmaptiles"));
});

test("what remains is streets, buildings, parks, water and names", () => {
  const kinds = new Set(style.layers.map((l) => l["source-layer"]).filter(Boolean));
  const allowed = new Set([
    "park", "water", "landcover", "landuse", "waterway", "building", "transportation", "aeroway", "boundary",
    "water_name", "transportation_name", "place",
  ]);
  assert.deepEqual([...kinds].filter((k) => !allowed.has(k)), []);
});

test("the map's city box is a real box around the centre, and the centre is a pin-able place", () => {
  const b = MAP_AREA.bounds;
  assert.ok(b.south < b.north && b.west < b.east);
  assert.ok(inMapArea(MAP_AREA.center.lat, MAP_AREA.center.lng));
  assert.ok(!inMapArea(33.3152, 44.3661), "Baghdad is not Sulaymaniyah");
  assert.ok(!inMapArea(36.19, 44.01), "Erbil is not Sulaymaniyah");
  assert.ok(inMapArea(35.5558, 45.4351), "the city centre");
});
