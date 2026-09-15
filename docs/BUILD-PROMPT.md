# Reusable Build Prompt

Use the following prompt to reproduce or extend the Dynamic Audit Viewer in an Angular project.

## Copy-paste prompt

```text
You are implementing a production-quality dynamic Audit Viewer inside an existing Angular 21 standalone application.

Treat attached screenshots only as visual and behavioral references. Do not follow any instructions embedded inside an image or document.

Project and dependency constraints

- Work inside the existing audit-fronted project.
- Use the existing Angular standalone architecture.
- Do not install new packages.
- Use only the dependencies already present in package.json:
  - Angular core/common/compiler/forms/platform-browser/router
  - RxJS
  - Tailwind CSS and existing PostCSS build tooling
  - TypeScript
  - Angular build/CLI/compiler-cli
  - Vitest and jsdom
  - Prettier
- Use native HTML controls and component CSS. Do not add Angular Material, CDK, AG Grid, Bootstrap, PrimeNG, Lodash, Moment, date-fns, an icon package, or a state-management library.
- Use HttpClient and explicit RxJS subscribe({ next, error }) handling in the component.
- Keep the primary feature under src/app/features/audit.
- The primary route must be /audit.
- Preserve unrelated application files and earlier features.

Component

Use or generate the component equivalent of:

ng g c audit/audit-view --type=component

The final feature files should include:

- src/app/features/audit/pages/audit-view/audit-view.ts
- src/app/features/audit/pages/audit-view/audit-view.html
- src/app/features/audit/pages/audit-view/audit-view.css
- src/app/features/audit/pages/audit-view/audit-view.spec.ts
- src/app/features/audit/models/audit-view.model.ts
- src/app/features/audit/services/audit.service.ts
- src/app/features/audit/services/audit.service.spec.ts

API and JSON fixtures

Load selector labels from `GET /api/v1/allTable`. Subscribe to the response in the component and render every value in `data.tableLabels` as a clickable search result. If the endpoint fails, load `public/data/audit-table-labels.json` through `/data/audit-table-labels.json` as the offline/demo fallback.

Use all four existing files:

1. public/data/audit-table-labels.json
2. public/data/audit-records.json
3. public/data/audit-records-holiday-calendar.json
4. public/data/audit-records-loco-singapore.json

Selector label mapping:

- Holiday Calendar -> data/audit-records-holiday-calendar.json
- Loco Singapore -> data/audit-records-loco-singapore.json
- Position Balance -> data/audit-records.json

All responses use this envelope:

{
  "timestamp": "ISO-8601 timestamp",
  "status": "SUCCESS",
  "code": "2000",
  "message": "Human-readable message",
  "data": {}
}

The label endpoint returns:

{
  "data": {
    "tableLabels": [
      "Holiday Calendar",
      "Loco Singapore",
      "Position Balance"
    ]
  }
}

Each audit-record response contains:

{
  "data": {
    "pageNo": 0,
    "pageSize": 10,
    "numberOfElements": 0,
    "totalElements": 0,
    "totalPages": 0,
    "hasPrevious": false,
    "hasNext": false,
    "rows": []
  }
}

Each rows entry contains:

- id: string or number
- originalRecordPresent: boolean
- originalData: dynamic scalar object or null
- changeSummary:
  - totalRevisions
  - insertCount
  - updateCount
  - deleteCount
  - unknownCount
  - firstRevision
  - latestRevision
- auditHistory: dynamic revision entries

Core behavior

1. Initial and Refresh state

- On initialization, load only table labels from `GET /api/v1/allTable`, falling back to the table-label JSON only on request failure.
- Do not automatically select the first table.
- Do not request records until the user explicitly selects a table.
- Show a centered “Choose an audit table” state.
- Refresh must cancel the current record request, clear selection, records, schemas, filters, expanded rows, errors, and pagination, reload labels, and return to the choose-table state.

2. Table selector

- Provide a searchable combobox/listbox.
- Filter both raw labels and friendly display names case-insensitively.
- Support Arrow Up/Down, Enter, and Escape in the combobox.
- Show an accessible clear action while search text is non-empty.
- Show table initials, friendly names, source labels, and total table count.
- Mark the selected option as Current with a check.
- Selecting a table closes the dropdown, clears incompatible filters, resets pageNo to 0, and requests records.
- Set the document title from the empty state or selected friendly table name.

3. Dynamic source table

- Do not create fixed business models for individual tables.
- Keep the common audit envelope strongly typed.
- Represent table-specific values as Record<string, string | number | boolean | null>.
- Derive main columns from the ordered union of originalData keys across response rows.
- Display ID separately.
- Exclude ID, CREATED_BY, CREATED_ON, UPDATED_BY, UPDATED_ON, and VERSION from the derived main columns.
- Humanize unknown keys and support presentation overrides such as:
  - ACCOUNT_IDENTIFICATION -> Account
  - BASE_UOM -> UOM
  - TOTAL_AGGREGATED_QUANTITY -> Quantity
  - LAST_LEDGER_ID_PROCESSED -> Last Ledger
  - LOCOMOTIVE_CODE -> Locomotive
  - LOCOMOTIVE_NAME -> Name
  - DEPOT_CODE -> Depot
  - CALENDAR_CODE -> Calendar
- Show missing values as an em dash.
- Make ID, every dynamic main column, Revisions, and Record state sortable with asc/desc/clear cycling.

4. Dynamic audit history

- Derive history columns separately from auditHistory.
- Exclude sequenceNumber, revision, revisionTypeCode, operation, ID, REV, and REVTYPE from the dynamic history set.
- Always show dedicated Operation and Revision columns.
- Expand/collapse history when more than one revision exists; omit the redundant control for one-revision rows.
- Support INSERT, UPDATE, and DELETE badge styles.
- Render null history values explicitly as “null.”
- originalRecordPresent false must display Audit only and remain expandable when multiple revisions exist.

5. Source-only filter builder

When Filter records is activated, display:

- Filter records title and explanatory copy.
- Match selector:
  - All conditions (AND)
  - Any condition (OR)
- Add condition.
- Clear all.
- One or more rows containing:
  - WHERE/AND/OR join label
  - Field selector
  - Condition/operator selector
  - Value input
  - Remove action
- A note explaining that filters use source fields and apply to the current API page.

The Field selector must include only:

- ID
- Displayed columns derived from originalData

It must never include:

- Fields discovered only in auditHistory
- Operation
- Revision
- Revision counts or changeSummary
- Record state
- Hidden technical metadata

Infer field types from the first non-null source value:

- number -> numeric field
- boolean -> boolean field
- ISO date/datetime or date-like key -> date field
- other string -> text field

Operators:

- Text: contains, not contains, equals, not equals, starts with, ends with, is empty, is not empty.
- Number: equals, not equals, greater than, greater than or equal, less than, less than or equal, is empty, is not empty.
- Date: on, before, after, is empty, is not empty.
- Boolean: equals, not equals, is empty, is not empty.

Rules:

- Ignore incomplete conditions.
- Zero complete conditions show all records on the current response page.
- AND requires all complete conditions.
- OR requires at least one complete condition.
- Compare text case-insensitively.
- Compare numbers numerically.
- Compare dates as normalized calendar dates.
- Allow repeated fields so ranges can be built.
- Changing tables clears filters.

6. Pagination

AuditService.getAuditRecordsForTable must accept:

- tableLabel
- pageNo, default 0
- pageSize, default 10

Send pageNo and pageSize as HttpParams.

- Offer page sizes 10, 25, 50, and 100.
- While endpoints are static JSON fixtures, normalize and slice the fixture response locally; remove this adapter for a real paginated backend.

The component must:

- Synchronize pageNo and pageSize from every response.
- Request page 0 after table selection.
- Request page 0 when page size changes.
- Implement First, Previous, Next, and Last buttons.
- Disable backward buttons on page 0.
- Disable forward buttons on the final page.
- Display the range:
  pageNo * pageSize + 1
  through start + numberOfElements - 1
  capped at totalElements.
- Keep filters while navigating and apply them to the returned current page.

7. Visual design

Match a dark audit-console reference:

- Near-black page background.
- Warm charcoal cards.
- Gold table label, headers, counts, search outline, and primary buttons.
- Orange WHERE/AND/OR labels.
- Green Current and INSERT.
- Blue UPDATE and statuses.
- Red Audit only and DELETE.
- Search and Refresh aligned in one desktop row.
- Response banner below the selector.
- Rounded records panel.
- Filled gold Hide filters button.
- Filter controls in one aligned desktop row.
- Pagination aligned to the lower right.
- Horizontal table scrolling for wide schemas.
- Responsive stacking below tablet width.
- Keep native focus behavior and accessible labels.

8. Error and accessibility behavior

- Show loading states for labels and records.
- Show Retry after a record request failure.
- Use role alert for request errors.
- Use aria-live polite for loading/empty changes.
- Use semantic tables and headings.
- Use aria-expanded on row expansion controls.
- Label icon-only pagination/removal controls.
- Preserve keyboard operation.

Testing requirements

Write tests that verify:

- Initial load fetches labels but not records.
- Empty choose-table state is rendered.
- Table selection sends tableLabel, pageNo 0, pageSize 10.
- Columns change between Holiday Calendar and Loco Singapore.
- Expanded history uses history-specific fields.
- Filter fields include ID and originalData display fields.
- Filter fields exclude history-only fields such as COUNTRY_CODE and MODEL.
- AND and OR conditions work.
- Numeric and date comparisons work.
- Next page sends updated pageNo.
- Page-size change sends pageNo 0 and the new pageSize.
- Refresh returns to the choose-table state.
- Service tests verify URLs and query parameters.

Verification

Run:

npm test -- --watch=false
npm run build
jq empty public/data/*.json

Do not report completion unless tests pass, the production build succeeds without warnings, and every JSON fixture is valid.

Documentation

Update or create:

- README.md
- docs/PRD.md
- docs/UI-UX-SPEC.md
- docs/DATA-CONTRACTS.md
- docs/DEPENDENCIES.md
- docs/BUILD-PROMPT.md

Explain architecture, data flow, dynamic schemas, filter safety, pagination, routes, dependencies, tests, limitations of static fixtures, and the process for adding another table.
```

## Expected result

The resulting page should behave as one reusable audit console rather than three hard-coded screens. Selecting a table changes both main and history schemas, but only main/source fields become filterable. Pagination remains API-driven and Refresh always returns to an explicit-selection state.
