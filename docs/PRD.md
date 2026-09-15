# Product Requirements: Audit History Viewer

## Goal

Provide one reusable audit screen that discovers selectable tables from the backend and renders
each selected table's current records and revision history without table-specific templates.

## Functional requirements

1. On page initialization, call `GET /api/v1/audit/allTable`.
2. Render every value in `data.tableLabels` in a searchable, keyboard-accessible selector.
3. Do not request records before the user selects a table.
4. On selection, call
   `GET /api/v1/audit/{encodedLabel}?pageNo=0&pageSize={selectedSize}`.
5. Rebuild main and history schemas from the selected response.
6. Keep filters limited to source fields from `originalData`.
7. Allow independent AND/OR joins for added filter conditions.
8. Keep server pagination dynamic and reset to page zero when page size changes.
9. Refresh returns to the choose-table state and reloads table labels.
10. Show explicit loading, empty, error, and retry states.
11. Never substitute local data for a failed API response.

## API envelope

The frontend consumes `timestamp`, `message`, and `data`. It does not require or display
business-envelope `status` or `code`.

## Dynamic-table requirements

- ID, revision count, and record state are fixed semantic columns.
- Other main columns come from `originalData`.
- History columns come from `auditHistory` and may differ per table or record.
- Null main values display an em dash.
- Null history values display `null`.
- Wide history data must remain horizontally scrollable.

## Filtering

- Supported conditions: contains, starts with, equals, not equals, greater/greater-or-equal,
  less/less-or-equal, is empty, and is not empty.
- Numeric and date fields use ordered comparison.
- Each rule after the first independently joins with AND or OR.
- AND groups are evaluated before OR groups.
- Filtering applies to the current API page only.

## Non-functional requirements

- Typed HttpClient service.
- Explicit component subscriptions and cleanup.
- Accessible roles, labels, focus treatment, and keyboard selectors.
- Feature-specific CSS in `audit-view.css`.
- No additional UI dependency.
- Unit tests for service endpoints, pagination parameters, error propagation, and feature behavior.
- Production build must pass.

## Acceptance criteria

- Network traffic uses only the two documented audit endpoints.
- Selecting a label immediately starts the corresponding record request.
- Query parameters reflect page controls.
- API errors display an error state and do not display previously configured records.
- No runtime JSON audit files or legacy fixed-schema page remain.
