# Data Contracts and JSON Catalog

## Canonical JSON assets

These four files are the complete, executable fixture data. They are copied to the application root by Angular's public asset configuration.

| Purpose                       | Canonical file                                     | Browser URL                               |
| ----------------------------- | -------------------------------------------------- | ----------------------------------------- |
| Audit table selector fallback | ../public/data/audit-table-labels.json             | /data/audit-table-labels.json             |
| Position Balance records      | ../public/data/audit-records.json                  | /data/audit-records.json                  |
| Holiday Calendar records      | ../public/data/audit-records-holiday-calendar.json | /data/audit-records-holiday-calendar.json |
| Loco Singapore records        | ../public/data/audit-records-loco-singapore.json   | /data/audit-records-loco-singapore.json   |

The live selector source is `GET /api/v1/allTable`. If that request fails, the service requests `/data/audit-table-labels.json`, allowing the same feature to work in offline and demonstration environments. The record files remain the executable development fixtures.

## Shared response envelope

Every response follows this structure:

```json
{
  "timestamp": "2026-09-14T09:25:00Z",
  "status": "SUCCESS",
  "code": "2000",
  "message": "Request completed successfully",
  "data": {}
}
```

| Field     | Type            | Required | Meaning                         |
| --------- | --------------- | -------- | ------------------------------- |
| timestamp | ISO 8601 string | Yes      | Server response time            |
| status    | string          | Yes      | Business result status          |
| code      | string          | Yes      | Business response code          |
| message   | string          | Yes      | Human-readable response message |
| data      | object          | Yes      | Endpoint-specific body          |

## Table-label response

Canonical example:

```json
{
  "timestamp": "2026-09-14T04:30:00Z",
  "status": "SUCCESS",
  "code": "2000",
  "message": "Request completed successfully",
  "data": {
    "tableLabels": ["Holiday Calendar", "Loco Singapore", "Position Balance"]
  }
}
```

### Rules

- Request labels from `GET /api/v1/allTable` first.
- Render every string in data.tableLabels as a clickable selector option.
- Fall back to `/data/audit-table-labels.json` only when the live request fails.
- tableLabels is an ordered array of unique strings.
- The label is both the user-facing selector identity and the service lookup input.
- Except for Position Balance, a label maps to a file slug by trimming, lowercasing, replacing non-alphanumeric groups with hyphens, and trimming edge hyphens.
- Position Balance intentionally maps to audit-records.json.

## Table-record request

For a selected label, request `GET /api/v1/{encodedTableLabel}` with zero-based `pageNo` and positive `pageSize` query parameters. For example, Position Balance uses `/api/v1/Position%20Balance?pageNo=0&pageSize=10`. Treat a successful backend response as authoritative. If it fails, request the configured JSON fixture and apply paging locally.

## Paginated audit response

```json
{
  "timestamp": "2026-09-14T09:25:00Z",
  "status": "SUCCESS",
  "code": "2000",
  "message": "Request completed successfully",
  "data": {
    "pageNo": 0,
    "pageSize": 10,
    "numberOfElements": 1,
    "totalElements": 1,
    "totalPages": 1,
    "hasPrevious": false,
    "hasNext": false,
    "rows": [
      {
        "id": 3001,
        "originalRecordPresent": true,
        "originalData": {
          "ID": 3001,
          "HOLIDAY_DATE": "2026-08-09",
          "CALENDAR_CODE": "SG",
          "CALENDAR_NAME": "Singapore Public Holidays"
        },
        "changeSummary": {
          "totalRevisions": 2,
          "insertCount": 1,
          "updateCount": 1,
          "deleteCount": 0,
          "unknownCount": 0,
          "firstRevision": 9401,
          "latestRevision": 9450
        },
        "auditHistory": [
          {
            "sequenceNumber": 1,
            "revision": 9401,
            "revisionTypeCode": 0,
            "operation": "INSERT",
            "ID": 3001,
            "REV": 9401,
            "REVTYPE": 0,
            "HOLIDAY_DATE": "2026-08-09",
            "CALENDAR_CODE": "SG",
            "CALENDAR_NAME": "Singapore Holidays"
          }
        ]
      }
    ]
  }
}
```

## Pagination fields

| Field            | Type    | Rules                                    |
| ---------------- | ------- | ---------------------------------------- |
| pageNo           | number  | Zero-based current page                  |
| pageSize         | number  | Requested/returned maximum rows per page |
| numberOfElements | number  | Rows actually returned on this page      |
| totalElements    | number  | Total matching records across all pages  |
| totalPages       | number  | Total number of pages                    |
| hasPrevious      | boolean | True when an earlier page exists         |
| hasNext          | boolean | True when a later page exists            |
| rows             | array   | Current page of audit record groups      |

Consistency rules:

- numberOfElements must equal rows.length.
- pageNo must be between 0 and totalPages - 1 when totalPages is greater than zero.
- hasPrevious should equal pageNo > 0.
- hasNext should equal pageNo < totalPages - 1.
- totalPages should normally equal ceiling(totalElements / pageSize).
- An empty result may use pageNo 0, numberOfElements 0, totalElements 0, and totalPages 0.

The bundled files contain complete demonstration datasets. AuditService slices those fixture rows and recalculates this metadata for the requested pageNo/pageSize. A production endpoint should return an already-paginated response, at which point the fixture adapter can be removed.

## Audit record group

| Field                 | Type             | Meaning                                            |
| --------------------- | ---------------- | -------------------------------------------------- |
| id                    | string or number | Stable source-record identifier                    |
| originalRecordPresent | boolean          | Whether the source table still contains the record |
| originalData          | object or null   | Current source snapshot                            |
| changeSummary         | object           | Aggregated operation/revision counts               |
| auditHistory          | array            | Ordered historical snapshots                       |

### originalData rules

- Contains only scalar values: string, number, boolean, or null.
- Field names may differ by table.
- ID should agree with the top-level id when present.
- originalData may be null when originalRecordPresent is false.
- The UI builds the main schema from the ordered union of originalData keys.
- Technical keys may be excluded from display through component configuration.

### changeSummary rules

```json
{
  "totalRevisions": 2,
  "insertCount": 1,
  "updateCount": 1,
  "deleteCount": 0,
  "unknownCount": 0,
  "firstRevision": 9063,
  "latestRevision": 9071
}
```

- totalRevisions should equal auditHistory.length.
- Operation counts should add up to totalRevisions.
- firstRevision and latestRevision define the inclusive revision span.

### auditHistory rules

Every entry contains:

| Field            | Type             | Meaning                                          |
| ---------------- | ---------------- | ------------------------------------------------ |
| sequenceNumber   | number           | One-based order within this record's history     |
| revision         | number           | Canonical revision number used by the UI         |
| revisionTypeCode | number           | Numeric operation type                           |
| operation        | string           | INSERT, UPDATE, DELETE, or another backend value |
| ID               | string or number | Source record ID at the revision                 |
| REV              | number           | Raw audit revision field                         |
| REVTYPE          | number           | Raw audit operation field                        |
| Additional keys  | scalar           | Table-specific revision snapshot                 |

Known operation mapping:

| revisionTypeCode / REVTYPE | operation |
| -------------------------: | --------- |
|                          0 | INSERT    |
|                          1 | UPDATE    |
|                          2 | DELETE    |

The UI uses operation text for badges and does not calculate it from the numeric code.

## Field matrix by JSON file

### Holiday Calendar

Source: ../public/data/audit-records-holiday-calendar.json

| Main/originalData fields | History-only additions |
| ------------------------ | ---------------------- |
| ID                       | HOLIDAY_NAME           |
| HOLIDAY_DATE             | —                      |
| CALENDAR_CODE            | —                      |
| CALENDAR_NAME            | —                      |
| CREATED_BY               | —                      |
| CREATED_ON               | —                      |
| UPDATED_BY               | —                      |
| UPDATED_ON               | —                      |
| VERSION                  | —                      |

Displayed main columns after exclusions:

- ID
- Holiday Date
- Calendar
- Calendar Name
- Revisions
- Record State

### Loco Singapore

Source: ../public/data/audit-records-loco-singapore.json

| Main/originalData fields | History-only additions |
| ------------------------ | ---------------------- |
| ID                       | COUNTRY_CODE           |
| LOCOMOTIVE_CODE          | MODEL                  |
| LOCOMOTIVE_NAME          | MANUFACTURER           |
| DEPOT_CODE               | COMMISSIONED_ON        |
| FLEET_STATUS             | —                      |
| LAST_UPDATED             | —                      |
| VERSION                  | —                      |

Displayed main columns after exclusions:

- ID
- Locomotive
- Name
- Depot
- Fleet Status
- Last Updated
- Revisions
- Record State

Record 1998 demonstrates originalRecordPresent false and originalData null. Its history remains visible.

### Position Balance

Source: ../public/data/audit-records.json

| Main/originalData fields  | History-specific metadata |
| ------------------------- | ------------------------- |
| ID                        | REV                       |
| ACCOUNT_IDENTIFICATION    | REVTYPE                   |
| BASE_UOM                  | operation/revision fields |
| LAST_LEDGER_ID_PROCESSED  | —                         |
| METAL_CODE                | —                         |
| TOTAL_AGGREGATED_QUANTITY | —                         |
| CREATED_BY                | —                         |
| CREATED_ON                | —                         |
| UPDATED_BY                | —                         |
| UPDATED_ON                | —                         |
| VERSION                   | —                         |

Displayed main columns after exclusions:

- ID
- Account
- UOM
- Last Ledger
- Metal Code
- Quantity
- Revisions
- Record State

## Display exclusion rules

Main schema excludes:

- ID, because it has a dedicated column.
- CREATED_BY.
- CREATED_ON.
- UPDATED_BY.
- UPDATED_ON.
- VERSION.

History schema excludes:

- sequenceNumber.
- revision.
- revisionTypeCode.
- operation.
- ID.
- REV.
- REVTYPE.

Operation and Revision remain visible as dedicated history columns.

## Filter-field contract

The filter Field selector is built from:

1. Dedicated ID.
2. Displayed main columns derived from originalData.

It must not use auditHistory to discover filter fields. Therefore COUNTRY_CODE, MODEL, MANUFACTURER, COMMISSIONED_ON, and HOLIDAY_NAME can appear in history without appearing as filter options unless the backend also returns them in originalData.

## Type inference

| Input value/key                                                | Inferred type |
| -------------------------------------------------------------- | ------------- |
| JavaScript/JSON number                                         | number        |
| JSON boolean                                                   | boolean       |
| ISO value or key ending in DATE, ON, AT, UPDATED, or TIMESTAMP | date          |
| Other string                                                   | text          |
| All values null                                                | text fallback |

A backend-provided schema is preferred if future pages can contain only null values or only audit-only rows.

## Adding a new JSON table

Example for label “Trade Instructions”:

1. Return “Trade Instructions” in `data.tableLabels` from `GET /api/v1/allTable`.
2. Add “Trade Instructions” to audit-table-labels.json for offline/demo fallback behavior.
3. Add public/data/audit-records-trade-instructions.json.
4. Use the shared envelope and page metadata.
5. Put current business fields in originalData.
6. Put complete revision snapshots in auditHistory.
7. Keep scalar values consistent by field across rows.
8. Validate and test.

```bash
jq empty public/data/*.json
npm test -- --watch=false
npm run build
```

## Real API replacement

The current service requests:

```text
GET {table-specific-url}?pageNo={zero-based-page}&pageSize={size}
```

A production endpoint must return the requested page and authoritative metadata. The Angular component intentionally trusts the returned pageNo and pageSize.
