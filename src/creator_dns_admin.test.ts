import test from "node:test";
import assert from "node:assert/strict";
import { deliveryRecord } from "./creator_dns_admin.ts";

test("creator delivery uses a CNAME record and a short TTL", () => {
  const record = deliveryRecord("example.com");
  assert.deepEqual(record, {
    zone_id: "example.com",
    record_type: "CNAME",
    name: "downloads",
    content: "delivery.example.com",
    ttl: 300,
    proxied: false
  });
});
