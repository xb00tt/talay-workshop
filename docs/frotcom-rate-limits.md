# Frotcom API Rate Limit Usage Guide

> Source: Official Frotcom API Rate Limit Usage Guide
> Reference this document when writing, editing, or reviewing Frotcom API code.

## Overview

Two types of rate limits are enforced:

1. **Company Rate Limit** — global limit on requests per company across all endpoints
2. **User/Endpoint Rate Limit** — specific limit for a user on a particular endpoint

## Response Headers

### Company Rate Limit Headers (returned for all requests)

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed for your entire company across all endpoints |
| `X-RateLimit-Remaining` | Requests remaining for your company in the current window |
| `X-RateLimit-Reset` | Unix timestamp (seconds) when the company-wide window resets |

### User/Endpoint Rate Limit Headers (returned for endpoints with `[RateLimit]` decoration)

| Header | Description |
|--------|-------------|
| `X-Endpoint-RateLimit-Limit` | Maximum requests allowed for the user on this endpoint within the time window |
| `X-Endpoint-RateLimit-Remaining` | Requests remaining for the user on this endpoint in the current window |
| `X-Endpoint-RateLimit-Reset` | Unix timestamp (seconds) when the endpoint rate limit window resets |

## Example Scenarios

### 1. Successful Request (Within Limits)

```
GET /api/vehicles/12345?api_key=<your_api_key>

Response: 200 OK
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9999
X-RateLimit-Reset: 1678886460
X-Endpoint-RateLimit-Limit: 100
X-Endpoint-RateLimit-Remaining: 99
X-Endpoint-RateLimit-Reset: 1678886460
```

### 2. Failed Request — Company Limit Exceeded

Request blocked because the total company requests exceeded the global limit, even if the individual user is still within their personal limit.

```
Response: 429 Too Many Requests
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1678886460
X-Endpoint-RateLimit-Limit: 100
X-Endpoint-RateLimit-Remaining: 50
X-Endpoint-RateLimit-Reset: 1678886460

Body: {
  "message": "Rate limit exceeded - the total requests in the last 15 minutes reached the threshold of 10000.",
  "statusCode": 429
}
```

### 3. Failed Request — User/Endpoint Limit Exceeded

User exceeded their personal limit for this specific endpoint; company-wide limit not reached.

```
Response: 429 Too Many Requests
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 5000
X-RateLimit-Reset: 1678886460
X-Endpoint-RateLimit-Limit: 100
X-Endpoint-RateLimit-Remaining: 0
X-Endpoint-RateLimit-Reset: 1678886460

Body: {
  "message": "Rate limit exceeded - the total requests in the last 15 minutes reached the threshold of 100.",
  "statusCode": 429
}
```

## Key Numbers

- **Company limit**: 10,000 requests per 15-minute window
- **Endpoint limit**: 100 requests per user per 15-minute window (on rate-limited endpoints)
- **Window**: 15 minutes (reset time provided as Unix timestamp in headers)

## Best Practices

1. **Monitor Response Headers** — Always check rate limit headers to track usage
2. **Cache Responses** — Cache API responses where possible to reduce request count
3. **Distribute Requests** — Spread API calls over time; avoid bursts

## Handling 429 in Code

When a `429 Too Many Requests` response is received:
- Check `X-RateLimit-Reset` or `X-Endpoint-RateLimit-Reset` to know when to retry
- Do NOT immediately retry — wait until the reset timestamp
- Log which limit was hit (company vs. endpoint) based on which `*-Remaining` header is `0`

`lib/frotcom.ts` handles both `401` (re-auth + retry) and `429` (reads the reset timestamp from headers, throws a descriptive error identifying which limit — company or endpoint — was hit and when it resets).
