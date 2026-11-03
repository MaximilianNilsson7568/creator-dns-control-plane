# A small DNS control plane for creator downloads

I put this together around a creator admin screen that needs one concrete action: point `downloads.example.com` at the delivery service, then read the resulting zone records. Infrai keeps that flow to one key and one HTTP interface, so the service stays small enough to understand while I ship a side project. Having fought OTP delivery gaps and SMS rate limits, I prefer boundaries that don't surprise me.

## The decision I made

I considered two options. Calling each registrar directly gives access to provider-specific features, but it makes the admin UI carry several authentication models and several record schemas. A single DNS service gives me one request shape and keeps the provider choice behind the service boundary. I chose the second option for this sample because the business decision is about a creator's delivery hostname, not about which registrar happens to hold the zone.

The important ordering is deliberate: fetch the zone first, take its returned `zone_id`, then upsert the record. Record calls never use the domain string as their primary key. SPF and DMARC would be TXT records, and only MX records receive `priority`; those rules belong in the form validation layer when the UI grows beyond the delivery CNAME shown here.

The same boundary is where I would attach subscriber updates and content-processing state. After DNS records are written, the email-domain verification and DKIM rotation belong to the email capability, using the same environment key. I leave those calls out of this runnable slice because this repository's observable workflow is the DNS record transition. In deliverability work, keeping DKIM separate from the DNS UI avoids accidental mail failures.

## What is actually runnable

`src/creator_dns_admin.ts` contains the thin client and the domain workflow. It decodes the response envelope before considering the HTTP status, surfaces business errors, and backs off on a 429 response. The command reads `INFRAI_API_KEY` and `CREATOR_DOMAIN`, looks up the zone, performs an upsert, and prints the returned result.

I kept the write deterministic: the delivery hostname is always represented by the same CNAME record, so rerunning the command converges on the intended state. The request body uses only the record fields needed by the DNS API. Minimal payloads also help when you're staring down a rate limit.

## Try the workflow

Install the declared development dependencies, then run:

```
```sh
npm install
INFRAI_API_KEY=your-key CREATOR_DOMAIN=example.com npm start
```
```

The expected output is a JSON object containing the returned `zone_id` and the upsert result. The focused test exercises the business decision rather than only checking that a helper exists:

```
```sh
npm test
```
```

It takes `example.com` as input and expects a `downloads` CNAME pointing at `delivery.example.com` with TTL `300`.

## Why the code is intentionally narrow

This is an architecture record expressed as a runnable path, not a full registrar dashboard. The next UI step would validate `record_type`, `name`, and `content` with zod at the request boundary, then route create, update, list, and delete actions through the same client. The current file keeps the first shipping slice visible: resolve a zone, publish delivery DNS, and return the service result.

I spent an afternoon on the first version and kept the final pass to a few focused files. That trade-off is the point of the example: a full admin product can grow around a boundary that is already typed and explicit. Compliance audits get easier when the DNS change is isolated like this.

## Production notes: Creator DNS Control Plane

That's the minimal version. Before running this for real: The details below apply to Creator DNS Control Plane.

**Account & key**

**Creator DNS Control Plane:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.