// Unit tests for the link-preview guard. Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedUrl, isImageHost, isPageHost, isPublicIp, metaContent, platformOf, sniffImage } from "./url-guard.ts";

test("post links are recognised by platform", () => {
  assert.equal(platformOf("https://www.instagram.com/p/abc/"), "instagram");
  assert.equal(platformOf("https://m.facebook.com/story.php?id=1"), "facebook");
  assert.equal(platformOf("https://fb.watch/xyz/"), "facebook");
  assert.equal(platformOf("https://vm.tiktok.com/ZM123/"), "tiktok");
  assert.equal(platformOf("https://youtu.be/abc"), "youtube");
  assert.equal(platformOf("https://story.snapchat.com/s/x"), "snapchat");
  assert.equal(platformOf("https://example.com/p/abc"), null);
  assert.equal(platformOf("not a url"), null);
});

test("look-alike hosts are not allowed", () => {
  assert.equal(isPageHost("instagram.com.evil.com"), false);
  assert.equal(isPageHost("evilinstagram.com"), false);
  assert.equal(isPageHost("www.instagram.com"), true);
  assert.equal(isImageHost("scontent.cdninstagram.com"), true);
  assert.equal(isImageHost("cdninstagram.com.evil.com"), false);
  assert.equal(isImageHost("127.0.0.1"), false);
});

test("urls: http(s) only, no credentials, standard ports", () => {
  assert.equal(isAllowedUrl("https://www.instagram.com/p/a", isPageHost), true);
  assert.equal(isAllowedUrl("ftp://www.instagram.com/p/a", isPageHost), false);
  assert.equal(isAllowedUrl("https://user:pw@www.instagram.com/p/a", isPageHost), false);
  assert.equal(isAllowedUrl("https://www.instagram.com:8080/p/a", isPageHost), false);
  assert.equal(isAllowedUrl("http://169.254.169.254/latest/meta-data", isPageHost), false);
});

test("private and special addresses are refused", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "999.1.1.1"]) {
    assert.equal(isPublicIp(ip, 4), false, ip);
  }
  for (const ip of ["::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "2001:db8::1"]) {
    assert.equal(isPublicIp(ip, 6), false, ip);
  }
  assert.equal(isPublicIp("157.240.1.35", 4), true);
  assert.equal(isPublicIp("172.32.0.1", 4), true);
  assert.equal(isPublicIp("2a03:2880:f12f:83:face:b00c:0:25de", 6), true);
});

test("meta tags in either attribute order, entities decoded", () => {
  const html = `<head><meta property="og:image" content="https://x.cdninstagram.com/a.jpg?x=1&amp;y=2">
    <meta content="Fresh fade &#039;n&#x27; beard" name="og:description"></head>`;
  assert.equal(metaContent(html, "og:image"), "https://x.cdninstagram.com/a.jpg?x=1&y=2");
  assert.equal(metaContent(html, "og:description"), "Fresh fade 'n' beard");
  assert.equal(metaContent(html, "og:title"), null);
});

test("images are recognised by their bytes, not their name", () => {
  assert.deepEqual(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2])), { type: "image/jpeg", ext: "jpg" });
  assert.deepEqual(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])), { type: "image/png", ext: "png" });
  const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
  assert.deepEqual(sniffImage(webp), { type: "image/webp", ext: "webp" });
  assert.equal(sniffImage(new TextEncoder().encode("<!doctype html><html>")), null);
  assert.equal(sniffImage(new Uint8Array()), null);
});
