# Audit Feature Architecture

## Design

The audit feature is a lazy-loaded, standalone Angular feature at `/audit`.

```mermaid
flowchart LR
    Router --> AuditView
    AuditView -->|subscribe| AuditService
    AuditService -->|GET /api/v1/audit/allTable| Backend
    AuditService -->|GET /api/v1/audit/label?pageNo&pageSize| Backend
    Backend -->|typed Observable response| AuditView
    AuditView --> Selector
    AuditView --> DynamicTable
    DynamicTable --> HistoryTable
```

## Ownership

### AuditService

- Owns both endpoint URLs.
- Trims and URL-encodes the selected label.
- Normalizes `pageNo` to a non-negative integer.
- Normalizes `pageSize` to a positive integer, defaulting to 10.
- Returns typed, cold HttpClient Observables.
- Propagates HTTP errors.

### AuditView

- Subscribes explicitly to label and record requests.
- Unsubscribes before replacing an in-flight request and on destroy.
- Owns loading, success, error, selection, filter, sort, expansion, and pagination state.
- Uses server pagination metadata as authoritative.
- Derives source columns from `originalData`.
- Derives history columns from each row's `auditHistory`.
- Exposes only source columns to the filter builder.

### Models

- `audit-table-label.model.ts`: table-label response.
- `audit-view.model.ts`: dynamic row, history, pagination, filter, and view models.

## Request sequence

```mermaid
sequenceDiagram
    participant User
    participant View as AuditView
    participant Service as AuditService
    participant API as Audit API

    View->>Service: getAuditTableLabels()
    Service->>API: GET /api/v1/audit/allTable
    API-->>Service: timestamp, message, data.tableLabels
    Service-->>View: Observable next
    User->>View: Select label
    View->>Service: getAuditRecords(label, 0, pageSize)
    Service->>API: GET /api/v1/audit/{label}?pageNo=0&pageSize=n
    API-->>Service: timestamp, message, data page
    Service-->>View: Observable next
    View-->>User: Dynamic records and history
```

On HTTP failure, the Observable errors and the component renders an error/retry state. No local
data source is queried.

## Pagination

The backend owns total counts and page boundaries. The component sends a zero-based page number
and selected size. A page-size change resets to page zero. First/previous/next/last controls are
enabled from response metadata.

## Dynamic schema

Main columns are the union of keys in non-null `originalData`, excluding technical audit fields.
History columns are computed per record from its history entries. A table change rebuilds both
schemas, so new backend tables work without a new component.

## Styling

Global `src/styles.css` contains only Tailwind import, base page colors, and scrollbar styling.
All audit presentation rules live in `audit-view.css` under Angular component encapsulation.
