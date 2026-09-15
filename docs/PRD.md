# Product Requirements Document: Dynamic Audit Viewer

## Document control

| Field         | Value                      |
| ------------- | -------------------------- |
| Product       | Audit Frontend             |
| Feature       | Dynamic audit-table viewer |
| Status        | Implemented baseline       |
| Version       | 1.0                        |
| Last updated  | 2026-09-15                 |
| Primary route | /audit                     |

## 1. Product summary

The Dynamic Audit Viewer lets operational and audit users inspect current source records and their complete revision history without building a separate Angular table for every database entity.

A user chooses one audit table from a searchable selector. The application requests that table's paginated audit response, derives the visible schema from JSON, renders current records, allows precise filtering of source fields, and reveals row-level revisions on demand.

## 2. Problem statement

Audit tables do not share one fixed business schema. Holiday records, locomotives, position balances, and future entities contain different fields. A fixed-column UI would require repeated components, repeated models, and repeated filter implementations.

The product therefore needs:

- One reusable page for multiple audit entities.
- Strict separation between current source data and historical revision data.
- Dynamic pagination controlled by API metadata.
- A filter builder that never offers history-only fields.
- A clear state before a table is selected.
- A consistent, high-density audit-console visual system.

## 3. Goals

1. Load table options independently from audit records.
2. Require an explicit table selection before loading records.
3. Derive main and history columns from the selected response.
4. Support records that no longer exist in the source table.
5. Provide typed current-page filtering.
6. Pass pageNo and pageSize to the records endpoint.
7. Keep the feature understandable, testable, and extensible without additional UI packages.
8. Match the supplied dark, gold-accented reference designs.

## 4. Non-goals

- Editing or restoring audited records.
- Comparing two revisions field by field.
- Exporting results.
- Authentication or role management.
- Server implementation.
- Persisting filters between browser sessions.
- Filtering across all API pages in the client.
- Introducing a third-party data-grid or component library.

## 5. Users

### Audit analyst

Needs to locate a table, filter records, and review every operation associated with a record.

### Operations user

Needs to confirm the current state and understand how it changed.

### Developer or integrator

Needs to connect the reusable UI to a real paginated API and add audit entities without duplicating the feature.

## 6. Primary user stories

- As a user, I want to see a clear instruction before choosing a table.
- As a user, I want to search the list of available audit tables.
- As a user, I want the columns to change when I select another table.
- As a user, I want to filter only by fields belonging to the current source record.
- As a user, I want numeric and date comparisons to behave according to their types.
- As a user, I want to combine conditions with AND or OR.
- As a user, I want to expand a record and see its revision history.
- As a user, I want deleted records to remain discoverable as audit-only records.
- As a user, I want page controls and ranges to follow the API response.
- As a user, I want Refresh to clear the current context and ask me to choose again.

## 7. Functional requirements

### FR-01: Load table labels

- On initialization, request the table-label response from `GET /api/v1/allTable`.
- If the endpoint fails, request the configured `/data/audit-table-labels.json` fallback.
- Do not request records automatically.
- Render every returned data.tableLabels entry as a clickable option.
- Display the number of available labels in the selector.
- Provide loading, no-match, and failure messages inside the selector.

### FR-02: Empty-selection state

- When no table is selected, show “Choose an audit table.”
- Explain that records load after selection.
- Do not show the records panel, response banner, filters, or pagination.
- The same state must appear after Refresh.

### FR-03: Searchable table selection

- Opening or typing in the table search shows matching options.
- Matching is case-insensitive across both source labels and visible display names.
- Arrow Up/Down moves through options, Enter selects, and Escape closes the menu.
- Non-empty search text provides a clear action.
- Each option shows initials, a display name, and its source label.
- The selected option shows Current and a confirmation mark.
- Selection closes the menu and starts at page 0 with the default page size.
- The document title identifies either the table-selection state or the selected friendly table name.

### FR-04: Table-specific source request

The mapping must be:

| Label            | Fixture endpoint                         |
| ---------------- | ---------------------------------------- |
| Holiday Calendar | data/audit-records-holiday-calendar.json |
| Loco Singapore   | data/audit-records-loco-singapore.json   |
| Position Balance | data/audit-records.json                  |

The request must include pageNo and pageSize query parameters.

### FR-05: Dynamic main schema

- Build the main schema from originalData in the selected response.
- Use the ordered union of fields across rows.
- Show ID separately.
- Exclude technical metadata configured by the component, including ID, creation/update metadata, and VERSION.
- Humanize unknown field names.
- Allow explicit presentation labels for known fields.
- Render missing values with an em dash.
- Every displayed source column, ID, Revisions, and Record state supports ascending, descending, and cleared sorting.

### FR-06: Dynamic history schema

- Build history columns from auditHistory independently from the main schema.
- Exclude sequenceNumber, revision, revisionTypeCode, operation, ID, REV, and REVTYPE from the dynamic set because operation and revision have dedicated columns.
- Preserve history-only fields inside the expanded table.
- Never add history-only fields to the main table or filter field list.

### FR-07: Record state

- originalRecordPresent true maps to Current.
- originalRecordPresent false maps to Audit only.
- Audit-only records may have null originalData and remain expandable when multiple revisions exist.

### FR-08: Row expansion

- Rows with multiple revisions have an expansion control; one-revision rows do not show a redundant control.
- Expanded content shows the number of revisions and the record ID.
- Each history row shows operation, revision, and the dynamic revision snapshot fields.
- INSERT, UPDATE, and DELETE use visually distinct labels.
- Expanding one row does not alter filtering or pagination.

### FR-09: Filter builder

- Filter controls appear only after Filter records is activated.
- Opening an empty builder creates one blank condition.
- Users can add repeated conditions, remove a condition, or clear all.
- Removing the final condition leaves one blank condition while the builder remains open.
- Clear all resets the match mode to AND and leaves one blank row while open.
- Changing tables clears all previous filters.

### FR-10: Filter field safety

The Field selector contains only:

- ID.
- Columns derived from displayed originalData.

It must exclude:

- auditHistory-only fields.
- operation and revision.
- changeSummary and revision count.
- record state.
- hidden technical metadata.

### FR-11: Typed operators

| Field type | Required behavior                                                  |
| ---------- | ------------------------------------------------------------------ |
| Text       | Contains, not contains, equals, not equals, starts with, ends with |
| Number     | Equality and numeric greater/less comparisons                      |
| Date       | On, before, and after using normalized calendar dates              |
| Boolean    | True/false equality                                                |
| Any type   | Is empty and is not empty                                          |

The component infers type from the first non-null source value, with ISO/date-field detection for date strings.

### FR-12: Match behavior

- AND requires every complete condition to match.
- OR requires at least one complete condition to match.
- Incomplete conditions are ignored.
- If no condition is complete, all records from the current response page are visible.
- Comparisons must be case-insensitive for text.
- Numeric comparisons must use numbers.
- Date comparisons must use parsed dates rather than lexical strings.

### FR-13: Pagination

- State is zero-based internally.
- Synchronize currentPageNo and itemsPerPage from each successful response.
- First and Previous are disabled on page 0.
- Next and Last are disabled on the final page.
- Page-size changes request page 0.
- Page-size choices are 10, 25, 50, and 100.
- Navigation keeps complete filter conditions but reapplies them only to the returned page.
- The visible range is derived from pageNo, pageSize, numberOfElements, and totalElements.

### FR-14: Refresh

Refresh must:

1. Cancel the active records subscription.
2. Clear selected table and search text.
3. Close menus and filters.
4. Reset pageNo to 0 and pageSize to 10.
5. Clear response, schemas, rows, errors, expansions, and filter conditions.
6. Reload table labels.
7. Display the empty-selection state.
8. Restore the default document title.

### FR-15: Response states

- While loading records, show an activity indicator and loading text.
- On failure, show an alert and Retry.
- If the selected response has no visible or matching records, show an empty result message.
- On fixture success, show a Sample data banner with the response message.

## 8. Data requirements

All data uses a shared top-level envelope with timestamp, status, code, message, and data.

The `GET /api/v1/allTable` response contains data.tableLabels. The fallback JSON uses the identical contract.

The records response contains:

- Zero-based page metadata.
- rows.
- For every row: id, originalRecordPresent, originalData, changeSummary, and auditHistory.

See [DATA-CONTRACTS.md](DATA-CONTRACTS.md).

## 9. UX requirements

### Visual language

- Near-black page background.
- Dark elevated panels.
- Gold/yellow primary accent.
- Orange condition keyword.
- Green Current state.
- Red Audit only and DELETE states.
- Blue UPDATE and operational status labels.
- Rounded controls with strong focus visibility.
- High-density tables that scroll horizontally when their schema is wide.

### Layout hierarchy

1. Audit Table label.
2. Searchable table picker and Refresh.
3. Empty state or response banner.
4. Record count and filter toggle.
5. Optional condition builder.
6. Dynamic records table.
7. Dynamic expanded history.
8. Pagination footer.

See [UI-UX-SPEC.md](UI-UX-SPEC.md).

## 10. Accessibility requirements

- Use semantic headings, tables, buttons, inputs, labels, and selects.
- Expose combobox/listbox state.
- Provide accessible labels for icon-only actions.
- Expose expanded/collapsed state.
- Announce loading/empty updates politely.
- Announce failures as alerts.
- Preserve native keyboard behavior and focus indication.
- Do not rely on color as the only status signal.

## 11. Performance requirements

- Lazy-load the audit route and page component.
- Avoid a separate component bundle per audit entity.
- Cancel an earlier records subscription before issuing a replacement.
- Filter only the current response page.
- Keep static assets and initial bundle within configured Angular budgets.

## 12. Acceptance criteria

- [x] Initial render loads labels but no records.
- [x] Refresh returns to the empty-selection state.
- [x] Selecting each supplied table loads the correct JSON.
- [x] Main columns change according to originalData.
- [x] History columns change according to auditHistory.
- [x] History-only fields do not appear in Filter Field.
- [x] AND and OR conditions behave correctly.
- [x] Text, numeric, and date comparisons are tested.
- [x] Page navigation sends pageNo and pageSize.
- [x] Changing page size requests page 0.
- [x] Pagination range is response-driven.
- [x] Audit-only rows remain represented.
- [x] No new dependency is introduced.
- [x] Unit tests and production build pass.

## 13. Test coverage

The Angular tests cover:

- Label-only initial loading.
- Explicit table selection.
- Schema change between tables.
- Expanded revision history.
- Strict source-only filter field options.
- Typed conditions and AND/OR behavior.
- Page navigation and page-size requests.
- Refresh reset behavior.
- HttpClient source URLs and query parameters.

Manual visual review covers the empty state and desktop alignment. Responsive rules stack filter controls on narrow screens.

## 14. Risks and mitigations

| Risk                                                        | Mitigation                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| A page contains only audit-only rows with null originalData | Prefer backend schema metadata or retain a known table schema across pages      |
| Static fixture URLs ignore query parameters                 | Treat fixtures as contract examples; production API must paginate               |
| Unknown date formats                                        | Standardize backend values on ISO 8601                                          |
| Very wide dynamic schemas                                   | Horizontal table containers preserve every column                               |
| Field type differs between rows                             | Backend should keep one type per field; inference uses the first non-null value |
| API returns stale response after rapid selection            | Existing subscription is unsubscribed before the next request                   |
| Filter conditions from one table target another schema      | Conditions are cleared on every table change                                    |

## 15. Future enhancements

- Backend-provided column metadata, labels, ordering, and data types.
- Server-side filter serialization.
- Revision-to-revision difference highlighting.
- Sort controls.
- Export to CSV.
- Saved filter presets.
- Deep links containing selected table and page.
- Automated browser-level accessibility and responsive tests.
