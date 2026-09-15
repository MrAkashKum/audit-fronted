# API-Only Migration: Dummy Data Removed

## Outcome

The audit feature now depends only on the backend. It does not load, synthesize, slice, or display
local JSON data when an HTTP request fails.

## Removed runtime data

The following files were deleted:

```text
public/data/audit-table-labels.json
public/data/audit-records.json
public/data/audit-records-holiday-calendar.json
public/data/audit-records-loco-singapore.json
```

`public/` now contains only `favicon.ico`.

## Removed code paths

- JSON endpoint constants and table-to-file mapping.
- The JSON-only `getAuditRecords()` implementation.
- Backend-to-JSON `catchError` fallback branches.
- Client-side fixture pagination and filename normalization.
- The `Sample data` banner and its CSS.
- The unused `tableLabelsResponse` component state.
- Envelope `status` and `code` fields.
- The legacy `/audit/cards` route and `audit-list` component.
- The fixed-schema `audit-record.model.ts` model used only by that legacy page.

## Final runtime structure

```text
Browser
  └── AuditView
      ├── subscribes to getAuditTableLabels()
      │   └── GET /api/v1/audit/allTable
      └── subscribes to getAuditRecords(label, pageNo, pageSize)
          └── GET /api/v1/audit/{encodedLabel}?pageNo=n&pageSize=n
```

## Service responsibility

`AuditService` owns endpoint composition, label encoding, page-parameter normalization, typed
`HttpClient` requests, and cold Observable returns. It does not subscribe and does not convert a
failed request into successful local data.

## Component responsibility

`AuditView` explicitly subscribes to both service methods, cancels stale subscriptions, updates
loading/success/error state, derives columns from the returned rows, and trusts the server's
pagination metadata.

## Current source tree

```text
src/app/features/audit/
├── audit.routes.ts
├── models/
│   ├── audit-table-label.model.ts
│   └── audit-view.model.ts
├── pages/audit-view/
│   ├── audit-view.ts
│   ├── audit-view.html
│   ├── audit-view.css
│   └── audit-view.spec.ts
└── services/
    ├── audit.service.ts
    └── audit.service.spec.ts
```

## Backend integration checklist

1. Serve `GET /api/v1/audit/allTable`.
2. Serve `GET /api/v1/audit/{labelName}` with `pageNo` and `pageSize`.
3. Return the envelopes documented in `docs/DATA-CONTRACTS.md`.
4. Return accurate pagination metadata for every record request.
5. Route the relative API path to the backend or configure CORS/proxying.
6. Use normal HTTP failure codes for failed requests; the UI error handler will show retry state.

## Verification

Service tests assert both exact endpoint paths, encoded labels, dynamic/default pagination,
invalid-parameter normalization, cold Observable behavior, and error propagation without a second
local-data request.
