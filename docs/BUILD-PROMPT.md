# Reusable Build Prompt

Build an Angular standalone audit-history feature at `/audit` using the dependencies already
declared in `package.json`.

Requirements:

1. Create typed models whose response envelope contains only `timestamp`, `message`, and
   `data`.
2. Add an `AuditService` with exactly these backend calls:
   - `GET /api/v1/audit/allTable`
   - `GET /api/v1/audit/{encodeURIComponent(labelName)}?pageNo={n}&pageSize={n}`
3. Return cold Observables from the service. Do not subscribe in the service.
4. Subscribe in the component with explicit next/error handlers and cancel stale subscriptions.
5. Do not include static audit JSON, mock runtime responses, client-side response replacement, or
   local pagination.
6. Do not load records until the user selects a table.
7. Derive main columns and filter fields only from `originalData`.
8. Derive history columns from `auditHistory`, excluding technical revision keys.
9. Implement independent AND/OR joins, typed filter operators, sorting, expandable history,
   horizontal history scrolling, and server-driven pagination.
10. Refresh must clear selection and reload `/api/v1/audit/allTable`.
11. Put audit presentation rules in `audit-view.css`; keep global CSS limited to application-wide
    rules.
12. Add service tests for exact URLs, encoded labels, dynamic/default pagination, normalization,
    cold Observables, and HTTP error propagation with no secondary request.
13. Add component tests for asynchronous subscription updates, selection, dynamic schemas,
    filtering, joins, paging, refresh, and error states.
14. Run `npm test -- --watch=false`, `npm run build`, and `git diff --check`.

The completed application must be ready to connect to a real backend without deleting or disabling
any demonstration-data logic because no such runtime logic should exist.
