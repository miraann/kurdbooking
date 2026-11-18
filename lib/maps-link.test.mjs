// Unit tests for map-link coordinates. Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { coordsFromMapsUrl, isMapsHost } from "./maps-link.ts";

test("the place's own pin is preferred over the view centre", () => {
  const url = "https://www.google.com/maps/place/Barber/@35.5601,45.4301,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d35.55583!4d45.43512!16s";
  assert.deepEqual(coordsFromMapsUrl(url), { lat: 35.55583, lng: 45.43512 });
});

test("a view centre alone is enough", () => {
  assert.deepEqual(coordsFromMapsUrl("https://www.google.com/maps/@35.5558,45.4351,15z"), { lat: 35.5558, lng: 45.4351 });
});

test("query parameters carry coordinates", () => {
  assert.deepEqual(coordsFromMapsUrl("https://www.google.com/maps?q=35.5558,45.4351"), { lat: 35.5558, lng: 45.4351 });
  assert.deepEqual(coordsFromMapsUrl("https://maps.google.com/?ll=35.5558,45.4351&z=14"), { lat: 35.5558, lng: 45.4351 });
  assert.deepEqual(coordsFromMapsUrl("https://www.google.com/maps/dir/?api=1&destination=35.5558%2C45.4351"), { lat: 35.5558, lng: 45.4351 });
  assert.deepEqual(coordsFromMapsUrl("https://www.google.com/maps?q=35.5558%2C%2045.4351"), { lat: 35.5558, lng: 45.4351 });
});

test("a place name in q= is not coordinates", () => {
  assert.equal(coordsFromMapsUrl("https://www.google.com/maps?q=Ali+Barber+Sulaimani"), null);
});

test("OpenStreetMap links work too", () => {
  assert.deepEqual(coordsFromMapsUrl("https://www.openstreetmap.org/?mlat=35.5558&mlon=45.4351#map=16/35.5558/45.4351"), { lat: 35.5558, lng: 45.4351 });
  assert.deepEqual(coordsFromMapsUrl("https://www.openstreetmap.org/#map=17/35.5558/45.4351"), { lat: 35.5558, lng: 45.4351 });
});

test("short links, junk and impossible values give nothing", () => {
  assert.equal(coordsFromMapsUrl("https://maps.app.goo.gl/AbCdEf123"), null);
  assert.equal(coordsFromMapsUrl("not a link"), null);
  assert.equal(coordsFromMapsUrl(""), null);
  assert.equal(coordsFromMapsUrl("https://www.google.com/maps/@95.5,45.4,15z"), null); // latitude out of range
  assert.equal(coordsFromMapsUrl("https://www.google.com/maps/@35.5,200.4,15z"), null); // longitude out of range
  assert.equal(coordsFromMapsUrl("https://www.google.com/maps/@0,0,15z"), null); // «null island» is a missing value
});

test("only map sites are opened to resolve a short link", () => {
  assert.ok(isMapsHost("maps.app.goo.gl"));
  assert.ok(isMapsHost("www.google.com"));
  assert.ok(isMapsHost("goo.gl"));
  assert.ok(isMapsHost("MAPS.GOOGLE.COM."));
  assert.ok(!isMapsHost("evil.com"));
  assert.ok(!isMapsHost("google.com.evil.com"));
  assert.ok(!isMapsHost("notgoogle.com"));
  assert.ok(!isMapsHost("169.254.169.254"));
});
