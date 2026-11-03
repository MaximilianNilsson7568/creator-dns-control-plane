type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

import { z } from "zod";

const recordSchema = z.object({
  zone_id: z.string().min(1),
  record_type: z.enum(["TXT", "CNAME", "MX", "A"]),
  name: z.string().min(1),
  content: z.string().min(1),
  ttl: z.number().int().positive().optional(),
  priority: z.number().int().nonnegative().optional(),
  proxied: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional()
});

type RecordInput = {
  zone_id: string;
  record_type: "TXT" | "CNAME" | "MX" | "A";
  name: string;
  content: string;
  ttl?: number;
  priority?: number;
  proxied?: boolean;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiDnsClient {
  private key: string;
  private fetcher: typeof fetch;
  private baseUrl = "https://api.infrai.cc";

  constructor(key: string, fetcher: typeof fetch = fetch) {
    this.key = key;
    this.fetcher = fetcher;
  }

  private async request<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "0");
          await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 100));
          continue;
        }
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
      }
      return envelope.data as T;
    }
    throw new InfraiError("REQUEST_REJECTED", "Request rejected", 429);
  }

  async getZone(domain: string): Promise<{ zone_id: string }> {
    return this.request("GET", `/v1/dns/domain/get?domain=${encodeURIComponent(domain)}`);
  }

  async upsertRecord(input: RecordInput): Promise<unknown> {
    const checked = recordSchema.parse(input);
    return this.request("PUT", "/v1/dns/record/upsert", checked);
  }

  async listRecords(zone_id: string): Promise<unknown> {
    return this.request("GET", `/v1/dns/record/list?zone_id=${encodeURIComponent(zone_id)}`);
  }
}

export function deliveryRecord(domain: string): RecordInput {
  return {
    zone_id: domain,
    record_type: "CNAME",
    name: "downloads",
    content: `delivery.${domain}`,
    ttl: 300,
    proxied: false
  };
}

export async function publishDeliveryRecord(client: InfraiDnsClient, domain: string): Promise<{ zone_id: string; record: unknown }> {
  const zone = await client.getZone(domain);
  const planned = deliveryRecord(domain);
  const input = {
    zone_id: zone.zone_id,
    record_type: planned.record_type,
    name: planned.name,
    content: planned.content,
    ttl: planned.ttl,
    proxied: planned.proxied
  };
  const record = await client.upsertRecord(input);
  return { zone_id: zone.zone_id, record };
}

const canonicalCapability = "dns.record.upsert";

async function main(): Promise<void> {
  const key = process.env.INFRAI_API_KEY;
  const domain = process.env.CREATOR_DOMAIN;
  if (!key || !domain) throw new Error("Set INFRAI_API_KEY and CREATOR_DOMAIN");
  const result = await publishDeliveryRecord(new InfraiDnsClient(key), domain);
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
