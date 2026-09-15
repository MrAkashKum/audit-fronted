# Architecture

## Overview

The Audit Viewer is a lazy-loaded Angular feature built around one reusable standalone page. It separates transport, common audit metadata, dynamic business fields, presentation schema, and interaction state.

```mermaid
flowchart LR
    Router[Angular Router] --> FeatureRoutes[Audit routes]
    FeatureRoutes --> View[AuditView standalone component]
    View --> Service[AuditService]
    Service --> Http[Angular HttpClient]
    Http --> Labels[Table labels JSON/API]
    Http --> Records[Table-specific records JSON/API]
    Records --> Model[Dynamic audit response model]
    Model --> SourceSchema[originalData schema]
    Model --> HistorySchema[auditHistory schema]
    SourceSchema --> Table[Main records table]
    SourceSchema --> Filters[Source-only filter builder]
    HistorySchema --> Expanded[Expanded history table]
```

## Responsibilities

### AuditView component

Owns presentation and page interaction state:

- Selected table.
- Table-search text and menu state.
- Records response and derived view rows.
- Main/history presentation columns.
- Filter conditions and match mode.
- Expanded row IDs.
- Current page and page size.
- Loading and failure messages.

It subscribes explicitly to service Observables and unsubscribes from an earlier records request before starting another.

### AuditService

Owns HTTP concerns:

- Labels endpoint.
- Label-to-record-source mapping.
- pageNo and pageSize query parameters.
- Typed Observable return values.

The service does not transform business fields or build columns.

### Models

The models strongly type stable structure and keep unstable business schema generic.

Stable:

- Envelope.
- Pagination.
- Record grouping.
- Change summary.
- Revision metadata.
- Filter and presentation types.

Dynamic:

- originalData fields.
- auditHistory snapshot fields.

### Templates

The template renders:

- Selector/listbox.
- Empty state.
- Response banner.
- Condition builder.
- Dynamic main table.
- Dynamic nested history table.
- Pagination.

The template never needs to know whether the selected entity is a holiday, locomotive, or position balance.

### JSON fixtures

The public data directory acts as the development API. Angular copies these files into the built application so HttpClient can request them from /data.

## Request sequence

```mermaid
sequenceDiagram
    actor User
    participant View as AuditView
    participant Service as AuditService
    participant Backend as Backend API
    participant Fixtures as JSON fixtures

    View->>Service: getAuditTableLabels()
    Service->>Backend: GET /api/v1/allTable
    alt Backend succeeds
        Backend-->>View: data.tableLabels
    else Backend fails
        Service->>Fixtures: GET /data/audit-table-labels.json
        Fixtures-->>View: data.tableLabels
    end
    Note over View: No record request yet

    User->>View: Select table
    View->>View: Reset filters, expansion, page 0
    View->>Service: getAuditRecordsForTable(label, 0, 10)
    Service->>Fixtures: GET source?pageNo=0&pageSize=10
    Fixtures-->>View: paginated audit response
    View->>View: Derive main/history schemas
    View-->>User: Render records

    User->>View: Next page or change size
    View->>Service: getAuditRecordsForTable(label, pageNo, pageSize)
    Fixtures-->>View: new page metadata and rows
    View-->>User: Render requested page

    User->>View: Refresh
    View->>View: Clear selected context
    View->>Service: getAuditTableLabels()
    View-->>User: Choose an audit table
```

## Schema derivation

### Main schema

Input: originalData objects from the current response rows.

Algorithm:

1. Iterate rows in API order.
2. Skip null originalData.
3. Add keys to an insertion-ordered Set.
4. Remove configured technical keys.
5. Humanize labels or apply known label overrides.
6. Infer text, number, date, or boolean type.
7. Map each record to values keyed by the derived schema.

### History schema

Input: every auditHistory entry from current response rows.

The algorithm is similar, but it uses a different exclusion set. This allows history snapshots to contain extra fields without changing the main table.

### Filter schema

Input: dedicated ID plus derived main columns.

History schema is deliberately not connected to filter schema.

```mermaid
flowchart TB
    Response --> Original[originalData]
    Response --> Audit[auditHistory]
    Original --> MainColumns[Main columns]
    MainColumns --> FilterFields[Filter fields]
    Audit --> HistoryColumns[History columns]
    HistoryColumns -. prohibited path .-> FilterFields
```

## Filter evaluation

Filtering is client-side and scoped to rows in the current API response.

```mermaid
flowchart LR
    Conditions[Conditions] --> Complete{Field selected and value supplied?}
    Complete -->|No| Ignore[Ignore condition]
    Complete -->|Yes| Type[Resolve inferred field type]
    Type --> Compare[Typed comparison]
    Compare --> Join{Match mode}
    Join -->|AND| Every[Every complete condition]
    Join -->|OR| Any[Any complete condition]
    Every --> Visible[Visible page rows]
    Any --> Visible
```

Values are compared as:

- Lowercased strings for text.
- Numbers for numeric fields.
- Normalized calendar-day timestamps for dates.
- Booleans for boolean fields.
- Direct null/empty checks for empty operators.

## Pagination ownership

For a real API, the response is authoritative for:

- pageNo.
- pageSize.
- numberOfElements.
- totalElements.
- totalPages.
- hasPrevious.
- hasNext.

The component calculates only button targets and the visible range. The current service includes a fixture-only adapter that slices static JSON rows and returns consistent page metadata for the requested pageNo/pageSize. Remove that adapter when a production backend performs server-side paging.

## State reset boundaries

| Event                   | Filters  | Expansion | Page           | Selection |
| ----------------------- | -------- | --------- | -------------- | --------- |
| Open/close filter panel | Preserve | Preserve  | Preserve       | Preserve  |
| Page navigation         | Preserve | Clear     | Requested page | Preserve  |
| Page-size change        | Preserve | Clear     | Reset to 0     | Preserve  |
| Change table            | Clear    | Clear     | Reset to 0/10  | Replace   |
| Refresh                 | Clear    | Clear     | Reset to 0/10  | Clear     |

## Routing and bundles

The root router lazy-loads audit.routes.ts. The default child route lazy-loads AuditView. The earlier cards route remains separately lazy-loaded.

This keeps the main bundle independent from feature templates and styles until /audit is visited.

## Extension points

### Real backend

Replace fixture URLs in AuditService with the production endpoint while preserving the Observable response type. If one endpoint handles every table, pass the selected table as a route segment or query parameter.

### Backend schema metadata

For robust pages containing only audit-only rows, extend data with column metadata:

```json
{
  "columns": [
    {
      "key": "LOCOMOTIVE_CODE",
      "label": "Locomotive",
      "type": "text",
      "filterable": true,
      "order": 1
    }
  ]
}
```

The UI can prefer metadata and fall back to response inference.

### Server-side filtering

Serialize complete conditions into a safe request DTO instead of sending arbitrary expressions. The backend should validate field names and operators against its own table schema.

## Technical constraints

- Standalone Angular APIs.
- Explicit RxJS subscription handling.
- No third-party grid or component system.
- Scalar dynamic values only.
- Zero-based page numbers.
- ISO 8601 dates recommended.
- Component CSS controls the feature's visual design.
