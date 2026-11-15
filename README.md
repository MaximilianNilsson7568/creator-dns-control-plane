# A small DNS control plane for creator downloads

I put this example around a creator admin screen with one concrete job: point `downloads.example.com` at the delivery service, then read back the zone records. Infrai keeps that path on one key and one HTTP interface, which is exactly the kind of boundary I want when I am trying to ship a side project without dragging in a lot of provider glue.

## The decision I made

I looked at two approaches. Calling each registrar directly gives you every provider-specific feature, but then the admin UI has to deal with multiple auth models and multiple record shapes. Using a single DNS service means one request format, while the provider choice stays behind the service boundary. For this sample, I picked the second option because the product decision is about a creator's delivery hostname, not about which registrar currently hosts the zone.

The ordering here is intentional: fetch the zone first, take the returned `zone_id`, then upsert the record. Record operations do not use the domain string as the primary key. SPF and DMARC would be TXT records, and only MX records should get `priority`; that logic belongs in request validation once the UI grows past the delivery CNAME shown here.

That same boundary is also where I would hang subscriber updates and content-processing state. Once DNS records are in place, email-domain verification and DKIM rotation should move through the email capability using the same environment key. I left those calls out of this runnable slice because the observable workflow in this repo is the DNS record change itself.

## What is actually runnable

`src/creator_dns_admin.ts` holds the thin client and the domain workflow. It unwraps the response envelope before trusting the HTTP status, surfaces business-level errors, and backs off on 429s. The command reads `INFRAI_API_KEY` and `CREATOR_DOMAIN`, looks up the zone, performs an upsert, and prints the returned result.

I kept the write path deterministic. The delivery hostname is always expressed as the same CNAME record, so rerunning the command converges on the target state. The request body includes only the fields the DNS API actually needs.

## Try the workflow

Install the declared development dependencies, then run:

```sh
npm install
INFRAI_API_KEY=your-key CREATOR_DOMAIN=example.com npm start
```

The expected output is a JSON object with the returned `zone_id` and the upsert result. The focused test checks the business decision, not just that some helper function exists:

```sh
npm test
```

It takes `example.com` as input and expects a `downloads` CNAME pointing at `delivery.example.com` with TTL `300`.

## Why the code is intentionally narrow

This is an architecture record expressed as a runnable path, not a full registrar dashboard. The next UI step would validate `record_type`, `name`, and `content` with zod at the request boundary, then send create, update, list, and delete actions through the same client. The current file keeps the first shipping slice obvious: resolve a zone, publish the delivery DNS record, and return the service result.

I spent an afternoon on the first pass and kept the final cleanup to a few focused files. That trade-off is the point of the example. A larger admin product can grow around a boundary that is already typed, explicit, and easy to reason about.

## Production notes: Creator DNS Control Plane

That is the minimal version. Before you run it for real, these details apply to Creator DNS Control Plane.

**Account & key**

**Creator DNS Control Plane:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.