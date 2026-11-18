// The customer app's map shows Sulaymaniyah city only (launch is Sulaimani, see the
// «customer-mobile-app» decision): the map can't be moved or zoomed out of this box,
// it opens centred on the city, and a branch outside it gets no pin. To open another
// city later, change this one constant.

export const MAP_AREA = {
  /** Where the map opens: the city centre. */
  center: { lat: 35.5558, lng: 45.4351 },
  /**
   * The city with its outskirts: south, west, north and east edges. The map never shows anything
   * outside it (the smallest zoom is worked out from the screen so that the box fills it, see
   * ShopMap), and a branch outside it gets no pin.
   */
  // (MapLibre zoom levels: 512px tiles, so every level is one step closer than a 256px map's)
  bounds: { south: 35.49, west: 45.3, north: 35.63, east: 45.52 },
  /** Never zoom out further than this, whatever the screen size. */
  minZoom: 11,
  /** Closest to a street. */
  maxZoom: 18,
  /** First view when there are no pins to fit. */
  zoom: 13,
} as const;

/** Is this point inside the city's box? */
export const inMapArea = (lat: number, lng: number) => {
  const b = MAP_AREA.bounds;
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
};
