---
name: functional-testing
description: Sandbox-based functional endpoint, routing, and api verification tests.
---

# Functional Testing Skill

This skill guides the Functional QA Engineer in validating the live behavior of the MEC Catalog web application (deployed on Vercel) from the Antigravity sandbox.

## 1. Network Sandbox Verification

Use terminal commands in the sandbox environment to execute `curl` requests or fetch assertions against the live endpoint `https://mec-catalog.vercel.app`.

### Testing Public Routes
Verify that public endpoints return a success status code (`200 OK`) and deliver valid HTML/JSON:
- Homepage: `curl -I https://mec-catalog.vercel.app/`
- Products/Catalog view: `curl -I https://mec-catalog.vercel.app/catalog` (or whichever public routes are active)

### Testing API JSON payloads
Ensure the API responds with correctly structured JSON data and appropriate headers:
```bash
curl -i -H "Accept: application/json" https://mec-catalog.vercel.app/api/articles
```

## 2. Admin Route Protection Check

Verify that the administrative route `/admin` is properly protected and redirects unauthorized requests:
- Run a request to `/admin` without cookies:
  ```bash
  curl -i https://mec-catalog.vercel.app/admin
  ```
- **Expectation**: It should return either a redirect (`302/307`) to `/admin/login`, or a `401/403` status if unauthorized.

## 3. Performance & Load Time Checks
Review page headers for speed insights and caching:
- Check if response header `x-vercel-cache` or `cache-control` is set correctly for static resources.
- Note any requests taking more than 500ms and flag them for optimization review.
