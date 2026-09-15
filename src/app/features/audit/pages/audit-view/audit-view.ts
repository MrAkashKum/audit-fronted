import {
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
} from "@angular/core";
import { Title } from "@angular/platform-browser";
import { Subscription } from "rxjs";

import {
  AuditCellValue,
  AuditFieldType,
  AuditFilterCondition,
  AuditFilterMatch,
  AuditFilterOperator,
  AuditFilterOperatorOption,
  AuditViewColumn,
  AuditViewRow,
  DynamicAuditApiResponse,
  DynamicAuditRecord,
} from "../../models/audit-view.model";
import { AuditService } from "../../services/audit.service";

type AuditSortDirection = "asc" | "desc" | "";

const SORT_ID = "ID";
const SORT_REVISIONS = "__REVISIONS__";
const SORT_RECORD_STATE = "__RECORD_STATE__";

@Component({
  selector: "app-audit-view",
  templateUrl: "./audit-view.html",
  styleUrl: "./audit-view.css",
})
export class AuditView implements OnInit, OnDestroy {
  private readonly auditService = inject(AuditService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly documentTitle = inject(Title);
  private auditRecordsSubscription?: Subscription;
  private tableLabelsSubscription?: Subscription;
  private nextFilterId = 1;
  private readonly defaultDocumentTitle = "Audit tables | Audit Frontend";

  private readonly mainColumnExclusions = new Set([
    "ID",
    "CREATED_BY",
    "CREATED_ON",
    "UPDATED_BY",
    "UPDATED_ON",
    "VERSION",
  ]);
  private readonly historyColumnExclusions = new Set([
    "sequenceNumber",
    "revision",
    "revisionTypeCode",
    "operation",
    "ID",
    "REV",
    "REVTYPE",
  ]);
  private readonly filterOperators: AuditFilterOperatorOption[] = [
    { value: "contains", label: "Contains" },
    { value: "equals", label: "Equals" },
    { value: "notEquals", label: "Not equals" },
    { value: "startsWith", label: "Starts with" },
    { value: "greaterThan", label: "Greater than" },
    { value: "greaterThanOrEqual", label: "Greater than or equal" },
    { value: "lessThan", label: "Less than" },
    { value: "lessThanOrEqual", label: "Less than or equal" },
    { value: "isEmpty", label: "Is empty" },
    { value: "isNotEmpty", label: "Is not empty" },
  ];

  recordsResponse: DynamicAuditApiResponse | null = null;
  rows: AuditViewRow[] = [];
  columns: AuditViewColumn[] = [];
  tableLabels: string[] = [];
  filterConditions: AuditFilterCondition[] = [];
  selectedTableLabel = "";
  tableSearchQuery = "";
  sortKey = "";
  sortDirection: AuditSortDirection = "";
  itemsPerPage = 10;
  currentPageNo = 0;
  isTableMenuOpen = false;
  activeTableOptionIndex = -1;
  openFieldConditionId: number | null = null;
  activeFieldOptionIndex = -1;
  openOperatorConditionId: number | null = null;
  activeOperatorOptionIndex = -1;
  isRecordFilterOpen = false;
  isRecordsLoading = false;
  areTableLabelsLoading = true;
  recordsErrorMessage = "";
  tableLabelsErrorMessage = "";
  readonly expandedRowIds = new Set<string | number>();

  get filteredTableLabels(): string[] {
    const searchTerm = this.tableSearchQuery.trim().toLocaleLowerCase();

    if (!searchTerm) {
      return this.tableLabels;
    }

    return this.tableLabels.filter((label) => {
      const searchableText =
        `${label} ${this.getTableDisplayName(label)}`.toLocaleLowerCase();
      return searchableText.includes(searchTerm);
    });
  }

  get filterFields(): AuditViewColumn[] {
    const idType: AuditFieldType = this.rows.some(
      (row) => typeof row.id === "number",
    )
      ? "number"
      : "text";

    return [{ key: "ID", label: "ID", dataType: idType }, ...this.columns];
  }

  get filterFieldOptions(): AuditViewColumn[] {
    return [
      { key: "", label: "Field", dataType: "text" },
      ...this.filterFields,
    ];
  }

  get activeFilterCount(): number {
    return this.filterConditions.filter((condition) =>
      this.isConditionComplete(condition),
    ).length;
  }

  get totalRecordCount(): number {
    return this.recordsResponse?.data.totalElements ?? this.rows.length;
  }

  get totalRecordLabel(): string {
    return this.totalRecordCount === 1 ? "Total record" : "Total records";
  }

  get filteredRows(): AuditViewRow[] {
    const activeConditions = this.filterConditions.filter((condition) =>
      this.isConditionComplete(condition),
    );

    const matchingRows =
      activeConditions.length === 0
        ? this.rows
        : this.rows.filter((row) =>
            this.matchesFilterExpression(row, activeConditions),
          );

    return this.sortRows(matchingRows);
  }

  get currentPageStart(): number {
    const page = this.recordsResponse?.data;

    if (!page || page.numberOfElements === 0) {
      return 0;
    }

    return page.pageNo * page.pageSize + 1;
  }

  get currentPageEnd(): number {
    const page = this.recordsResponse?.data;

    if (!page || page.numberOfElements === 0) {
      return 0;
    }

    return Math.min(
      this.currentPageStart + page.numberOfElements - 1,
      page.totalElements,
    );
  }

  get lastPageNo(): number {
    return Math.max((this.recordsResponse?.data.totalPages ?? 1) - 1, 0);
  }

  ngOnInit(): void {
    this.documentTitle.setTitle(this.defaultDocumentTitle);
    this.loadTableLabels();
  }

  loadTableLabels(): void {
    this.tableLabelsSubscription?.unsubscribe();
    this.areTableLabelsLoading = true;
    this.tableLabelsErrorMessage = "";

    this.tableLabelsSubscription = this.auditService
      .getAuditTableLabels()
      .subscribe({
        next: (response) => {
          this.tableLabels = response.data.tableLabels;
          this.areTableLabelsLoading = false;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          console.error("Unable to load audit table labels.", error);
          this.tableLabels = [];
          this.tableLabelsErrorMessage = "Unable to load audit tables.";
          this.areTableLabelsLoading = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  loadAuditRecords(
    tableLabel = this.selectedTableLabel,
    pageNo = this.currentPageNo,
    pageSize = this.itemsPerPage,
  ): void {
    if (!tableLabel) {
      return;
    }

    this.auditRecordsSubscription?.unsubscribe();
    this.isRecordsLoading = true;
    this.recordsErrorMessage = "";
    this.expandedRowIds.clear();

    this.auditRecordsSubscription = this.auditService
      .getAuditRecords(tableLabel, pageNo, pageSize)
      .subscribe({
        next: (response) => {
          this.recordsResponse = response;
          this.currentPageNo = response.data.pageNo;
          this.itemsPerPage = response.data.pageSize;
          this.columns = this.createColumns(response.data.rows, "originalData");
          this.rows = response.data.rows.map((record) =>
            this.toViewRow(record),
          );
          this.isRecordsLoading = false;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          console.error(
            "Unable to load audit records for " + tableLabel + ".",
            error,
          );
          this.recordsResponse = null;
          this.rows = [];
          this.columns = [];
          this.recordsErrorMessage =
            "Unable to load records for " + tableLabel + ".";
          this.isRecordsLoading = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  refresh(): void {
    this.auditRecordsSubscription?.unsubscribe();
    this.selectedTableLabel = "";
    this.tableSearchQuery = "";
    this.isTableMenuOpen = false;
    this.activeTableOptionIndex = -1;
    this.isRecordFilterOpen = false;
    this.currentPageNo = 0;
    this.isRecordsLoading = false;
    this.recordsResponse = null;
    this.rows = [];
    this.columns = [];
    this.recordsErrorMessage = "";
    this.expandedRowIds.clear();
    this.resetFilters();
    this.resetSorting();
    this.documentTitle.setTitle(this.defaultDocumentTitle);

    this.loadTableLabels();
  }

  onTableSearch(event: Event): void {
    this.tableSearchQuery = (event.target as HTMLInputElement).value;
    this.isTableMenuOpen = true;
    this.activeTableOptionIndex = this.filteredTableLabels.length > 0 ? 0 : -1;
  }

  clearTableSearch(): void {
    this.tableSearchQuery = "";
    this.isTableMenuOpen = true;
    const selectedIndex = this.filteredTableLabels.indexOf(
      this.selectedTableLabel,
    );
    this.activeTableOptionIndex = selectedIndex >= 0 ? selectedIndex : -1;
  }

  onTableSearchFocus(): void {
    this.isTableMenuOpen = true;
    const selectedIndex = this.filteredTableLabels.indexOf(
      this.selectedTableLabel,
    );
    this.activeTableOptionIndex = selectedIndex >= 0 ? selectedIndex : -1;
  }

  onTableSearchKeydown(event: KeyboardEvent): void {
    const options = this.filteredTableLabels;

    if (event.key === "Escape") {
      event.preventDefault();
      this.isTableMenuOpen = false;
      this.activeTableOptionIndex = -1;
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      this.isTableMenuOpen = true;

      if (options.length === 0) {
        this.activeTableOptionIndex = -1;
        return;
      }

      const offset = event.key === "ArrowDown" ? 1 : -1;
      const startingIndex =
        this.activeTableOptionIndex < 0
          ? offset > 0
            ? -1
            : 0
          : this.activeTableOptionIndex;
      this.activeTableOptionIndex =
        (startingIndex + offset + options.length) % options.length;
      return;
    }

    if (
      event.key === "Enter" &&
      this.isTableMenuOpen &&
      this.activeTableOptionIndex >= 0
    ) {
      event.preventDefault();
      const tableLabel = options[this.activeTableOptionIndex];

      if (tableLabel) {
        this.selectTable(tableLabel);
      }
    }
  }

  onTablePickerFocusOut(event: FocusEvent): void {
    const picker = event.currentTarget as HTMLElement;
    const nextTarget = event.relatedTarget;

    if (!(nextTarget instanceof Node) || !picker.contains(nextTarget)) {
      this.isTableMenuOpen = false;
      this.activeTableOptionIndex = -1;
    }
  }

  setActiveTableOption(index: number): void {
    this.activeTableOptionIndex = index;
  }

  getActiveTableOptionId(): string | null {
    return this.isTableMenuOpen && this.activeTableOptionIndex >= 0
      ? `audit-view-table-option-${this.activeTableOptionIndex}`
      : null;
  }

  selectTable(tableLabel: string): void {
    this.selectedTableLabel = tableLabel;
    this.tableSearchQuery = "";
    this.isTableMenuOpen = false;
    this.activeTableOptionIndex = -1;
    this.currentPageNo = 0;
    this.isRecordFilterOpen = false;
    this.resetFilters();
    this.resetSorting();
    this.documentTitle.setTitle(
      `${this.getTableDisplayName(tableLabel)} | Audit Frontend`,
    );
    this.loadAuditRecords(tableLabel, 0, this.itemsPerPage);
  }

  toggleRecordFilters(): void {
    this.isRecordFilterOpen = !this.isRecordFilterOpen;

    if (this.isRecordFilterOpen && this.filterConditions.length === 0) {
      this.addFilterCondition();
    }
  }

  addFilterCondition(): void {
    this.filterConditions = [
      ...this.filterConditions,
      {
        id: this.nextFilterId++,
        join: "AND",
        fieldKey: "",
        operator: "contains",
        value: "",
      },
    ];
  }

  removeFilterCondition(conditionId: number): void {
    if (this.openFieldConditionId === conditionId) {
      this.closeFilterFieldMenu();
    }

    if (this.openOperatorConditionId === conditionId) {
      this.closeFilterOperatorMenu();
    }

    this.filterConditions = this.filterConditions.filter(
      (condition) => condition.id !== conditionId,
    );

    if (this.isRecordFilterOpen && this.filterConditions.length === 0) {
      this.addFilterCondition();
    }
  }

  clearFilters(): void {
    this.resetFilters();

    if (this.isRecordFilterOpen) {
      this.addFilterCondition();
    }
  }

  setFilterConditionJoin(
    condition: AuditFilterCondition,
    join: AuditFilterMatch,
  ): void {
    condition.join = join;
  }

  toggleFilterFieldMenu(condition: AuditFilterCondition): void {
    if (this.openFieldConditionId === condition.id) {
      this.closeFilterFieldMenu();
      return;
    }

    this.closeFilterOperatorMenu();
    this.openFieldConditionId = condition.id;
    this.activeFieldOptionIndex = Math.max(
      this.filterFieldOptions.findIndex(
        (field) => field.key === condition.fieldKey,
      ),
      0,
    );
  }

  isFilterFieldMenuOpen(conditionId: number): boolean {
    return this.openFieldConditionId === conditionId;
  }

  selectFilterField(
    condition: AuditFilterCondition,
    fieldKey: string,
    trigger?: HTMLButtonElement,
  ): void {
    condition.fieldKey = fieldKey;
    this.closeFilterFieldMenu();
    queueMicrotask(() => trigger?.focus());
  }

  setActiveFilterField(index: number): void {
    this.activeFieldOptionIndex = index;
  }

  onFilterFieldKeydown(
    condition: AuditFilterCondition,
    event: KeyboardEvent,
    trigger: HTMLButtonElement,
  ): void {
    const isOpen = this.isFilterFieldMenuOpen(condition.id);

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      this.closeFilterFieldMenu();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();

      if (!isOpen) {
        this.toggleFilterFieldMenu(condition);
        return;
      }

      const offset = event.key === "ArrowDown" ? 1 : -1;
      this.activeFieldOptionIndex =
        (this.activeFieldOptionIndex +
          offset +
          this.filterFieldOptions.length) %
        this.filterFieldOptions.length;
      return;
    }

    if ((event.key === "Enter" || event.key === " ") && isOpen) {
      event.preventDefault();
      const activeField = this.filterFieldOptions[this.activeFieldOptionIndex];

      if (activeField) {
        this.selectFilterField(condition, activeField.key, trigger);
      }
    }
  }

  onFilterFieldFocusOut(conditionId: number, event: FocusEvent): void {
    const menu = event.currentTarget as HTMLElement;
    const nextTarget = event.relatedTarget;

    if (
      this.openFieldConditionId === conditionId &&
      (!(nextTarget instanceof Node) || !menu.contains(nextTarget))
    ) {
      this.closeFilterFieldMenu();
    }
  }

  getFilterFieldLabel(fieldKey: string): string {
    return (
      this.filterFieldOptions.find((field) => field.key === fieldKey)?.label ??
      "Field"
    );
  }

  getActiveFilterFieldOptionId(conditionId: number): string | null {
    return this.isFilterFieldMenuOpen(conditionId) &&
      this.activeFieldOptionIndex >= 0
      ? `filter-field-${conditionId}-${this.activeFieldOptionIndex}`
      : null;
  }

  toggleFilterOperatorMenu(condition: AuditFilterCondition): void {
    if (this.openOperatorConditionId === condition.id) {
      this.closeFilterOperatorMenu();
      return;
    }

    this.closeFilterFieldMenu();
    this.openOperatorConditionId = condition.id;
    this.activeOperatorOptionIndex = Math.max(
      this.filterOperators.findIndex(
        (option) => option.value === condition.operator,
      ),
      0,
    );
  }

  isFilterOperatorMenuOpen(conditionId: number): boolean {
    return this.openOperatorConditionId === conditionId;
  }

  selectFilterOperator(
    condition: AuditFilterCondition,
    operator: AuditFilterOperator,
    trigger?: HTMLButtonElement,
  ): void {
    condition.operator = operator;
    this.closeFilterOperatorMenu();
    queueMicrotask(() => trigger?.focus());
  }

  setActiveFilterOperator(index: number): void {
    this.activeOperatorOptionIndex = index;
  }

  onFilterOperatorKeydown(
    condition: AuditFilterCondition,
    event: KeyboardEvent,
    trigger: HTMLButtonElement,
  ): void {
    const isOpen = this.isFilterOperatorMenuOpen(condition.id);

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      this.closeFilterOperatorMenu();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();

      if (!isOpen) {
        this.toggleFilterOperatorMenu(condition);
        return;
      }

      const offset = event.key === "ArrowDown" ? 1 : -1;
      this.activeOperatorOptionIndex =
        (this.activeOperatorOptionIndex +
          offset +
          this.filterOperators.length) %
        this.filterOperators.length;
      return;
    }

    if ((event.key === "Enter" || event.key === " ") && isOpen) {
      event.preventDefault();
      const activeOperator =
        this.filterOperators[this.activeOperatorOptionIndex];

      if (activeOperator) {
        this.selectFilterOperator(condition, activeOperator.value, trigger);
      }
    }
  }

  onFilterOperatorFocusOut(conditionId: number, event: FocusEvent): void {
    const menu = event.currentTarget as HTMLElement;
    const nextTarget = event.relatedTarget;

    if (
      this.openOperatorConditionId === conditionId &&
      (!(nextTarget instanceof Node) || !menu.contains(nextTarget))
    ) {
      this.closeFilterOperatorMenu();
    }
  }

  getFilterOperatorLabel(operator: AuditFilterOperator): string {
    return (
      this.filterOperators.find((option) => option.value === operator)?.label ??
      "Condition"
    );
  }

  getActiveFilterOperatorOptionId(conditionId: number): string | null {
    return this.isFilterOperatorMenuOpen(conditionId) &&
      this.activeOperatorOptionIndex >= 0
      ? `filter-operator-${conditionId}-${this.activeOperatorOptionIndex}`
      : null;
  }

  onFilterValueChange(condition: AuditFilterCondition, event: Event): void {
    condition.value = (
      event.target as HTMLInputElement | HTMLSelectElement
    ).value;
  }

  getOperatorOptions(): AuditFilterOperatorOption[] {
    return this.filterOperators;
  }

  getFilterInputType(
    condition: AuditFilterCondition,
  ): "text" | "number" | "date" {
    const dataType = this.getFilterFieldType(condition.fieldKey);

    if (dataType === "number") {
      return "number";
    }

    if (dataType === "date") {
      return "date";
    }

    return "text";
  }

  isBooleanFilter(condition: AuditFilterCondition): boolean {
    return this.getFilterFieldType(condition.fieldKey) === "boolean";
  }

  hasFilterValueInput(condition: AuditFilterCondition): boolean {
    return (
      condition.operator !== "isEmpty" && condition.operator !== "isNotEmpty"
    );
  }

  onItemsPerPageChange(event: Event): void {
    const pageSize = Number((event.target as HTMLSelectElement).value);

    if (
      !this.selectedTableLabel ||
      !Number.isFinite(pageSize) ||
      pageSize <= 0
    ) {
      return;
    }

    this.itemsPerPage = pageSize;
    this.loadAuditRecords(this.selectedTableLabel, 0, pageSize);
  }

  goToPage(pageNo: number): void {
    if (!this.selectedTableLabel || this.isRecordsLoading) {
      return;
    }

    const targetPage = Math.min(Math.max(pageNo, 0), this.lastPageNo);

    if (targetPage === this.currentPageNo) {
      return;
    }

    this.loadAuditRecords(
      this.selectedTableLabel,
      targetPage,
      this.itemsPerPage,
    );
  }

  toggleSort(key: string): void {
    if (this.sortKey !== key) {
      this.sortKey = key;
      this.sortDirection = "asc";
      return;
    }

    if (this.sortDirection === "asc") {
      this.sortDirection = "desc";
      return;
    }

    this.resetSorting();
  }

  getAriaSort(key: string): "ascending" | "descending" | null {
    if (this.sortKey !== key || !this.sortDirection) {
      return null;
    }

    return this.sortDirection === "asc" ? "ascending" : "descending";
  }

  getSortIndicator(key: string): string {
    if (this.sortKey !== key || !this.sortDirection) {
      return "";
    }

    return this.sortDirection === "asc" ? "↑" : "↓";
  }

  canExpandRow(row: AuditViewRow): boolean {
    return row.revisionCount > 1 && row.auditHistory.length > 0;
  }

  toggleRow(rowId: string | number): void {
    if (this.expandedRowIds.has(rowId)) {
      this.expandedRowIds.delete(rowId);
      return;
    }

    this.expandedRowIds.clear();
    this.expandedRowIds.add(rowId);
  }

  isRowExpanded(rowId: string | number): boolean {
    return this.expandedRowIds.has(rowId);
  }

  getTableInitials(tableLabel: string): string {
    return this.getTableLabelWords(tableLabel)
      .slice(0, 2)
      .map((word) => word.charAt(0).toLocaleUpperCase())
      .join("");
  }

  getTableDisplayName(tableLabel: string): string {
    return this.getTableLabelWords(tableLabel).join(" ");
  }

  getCellValue(row: AuditViewRow, column: AuditViewColumn): AuditCellValue {
    return row.values[column.key] ?? null;
  }

  getHistoryValue(
    history: AuditViewRow["auditHistory"][number],
    column: AuditViewColumn,
  ): AuditCellValue {
    return history[column.key] ?? null;
  }

  formatCellValue(value: AuditCellValue, showNull = false): string {
    if (value === null || value === undefined) {
      return showNull ? "null" : "—";
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    if (typeof value === "number") {
      return value.toLocaleString();
    }

    return value;
  }

  isCodeColumn(columnKey: string): boolean {
    return (
      columnKey.endsWith("_CODE") ||
      columnKey.endsWith("_DATE") ||
      columnKey === "METAL_CODE"
    );
  }

  isStatusColumn(columnKey: string): boolean {
    return columnKey.includes("STATUS");
  }

  ngOnDestroy(): void {
    this.auditRecordsSubscription?.unsubscribe();
    this.tableLabelsSubscription?.unsubscribe();
  }

  private resetFilters(): void {
    this.filterConditions = [];
    this.nextFilterId = 1;
    this.closeFilterFieldMenu();
    this.closeFilterOperatorMenu();
  }

  private getTableLabelWords(tableLabel: string): string[] {
    return tableLabel
      .trim()
      .split(/[\s_-]+/)
      .filter(Boolean);
  }

  private closeFilterFieldMenu(): void {
    this.openFieldConditionId = null;
    this.activeFieldOptionIndex = -1;
  }

  private closeFilterOperatorMenu(): void {
    this.openOperatorConditionId = null;
    this.activeOperatorOptionIndex = -1;
  }

  private resetSorting(): void {
    this.sortKey = "";
    this.sortDirection = "";
  }

  private sortRows(rows: AuditViewRow[]): AuditViewRow[] {
    if (!this.sortKey || !this.sortDirection) {
      return rows;
    }

    const direction = this.sortDirection === "asc" ? 1 : -1;

    return [...rows].sort((left, right) => {
      const leftValue = this.getSortValue(left, this.sortKey);
      const rightValue = this.getSortValue(right, this.sortKey);

      if (leftValue === null || leftValue === undefined || leftValue === "") {
        return rightValue === null ||
          rightValue === undefined ||
          rightValue === ""
          ? 0
          : 1;
      }

      if (
        rightValue === null ||
        rightValue === undefined ||
        rightValue === ""
      ) {
        return -1;
      }

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction;
      }

      if (typeof leftValue === "boolean" && typeof rightValue === "boolean") {
        return (Number(leftValue) - Number(rightValue)) * direction;
      }

      return (
        String(leftValue).localeCompare(String(rightValue), undefined, {
          numeric: true,
          sensitivity: "base",
        }) * direction
      );
    });
  }

  private getSortValue(row: AuditViewRow, key: string): AuditCellValue {
    if (key === SORT_ID) {
      return row.id;
    }

    if (key === SORT_REVISIONS) {
      return row.revisionCount;
    }

    if (key === SORT_RECORD_STATE) {
      return row.recordState;
    }

    return row.values[key] ?? null;
  }

  private getFilterFieldType(fieldKey: string): AuditFieldType {
    return (
      this.filterFields.find((field) => field.key === fieldKey)?.dataType ??
      "text"
    );
  }

  private isConditionComplete(condition: AuditFilterCondition): boolean {
    return (
      Boolean(condition.fieldKey) &&
      (condition.operator === "isEmpty" ||
        condition.operator === "isNotEmpty" ||
        condition.value.trim().length > 0)
    );
  }

  private matchesCondition(
    row: AuditViewRow,
    condition: AuditFilterCondition,
  ): boolean {
    const sourceValue =
      condition.fieldKey === "ID" ? row.id : row.values[condition.fieldKey];
    const sourceText =
      sourceValue === null || sourceValue === undefined
        ? ""
        : String(sourceValue);
    const normalizedSource = sourceText.trim();
    const normalizedFilter = condition.value.trim();
    const isEmpty = normalizedSource.length === 0;

    if (condition.operator === "isEmpty") {
      return isEmpty;
    }

    if (condition.operator === "isNotEmpty") {
      return !isEmpty;
    }

    if (isEmpty) {
      return false;
    }

    const comparableSource = normalizedSource.toLocaleLowerCase();
    const comparableFilter = normalizedFilter.toLocaleLowerCase();
    const fieldType = this.getFilterFieldType(condition.fieldKey);

    switch (condition.operator) {
      case "contains":
        return comparableSource.includes(comparableFilter);
      case "startsWith":
        return comparableSource.startsWith(comparableFilter);
      case "equals":
        return this.areFilterValuesEqual(
          normalizedSource,
          normalizedFilter,
          fieldType,
        );
      case "notEquals":
        return !this.areFilterValuesEqual(
          normalizedSource,
          normalizedFilter,
          fieldType,
        );
      case "greaterThan":
      case "greaterThanOrEqual":
      case "lessThan":
      case "lessThanOrEqual":
        return this.compareOrderedValues(
          normalizedSource,
          normalizedFilter,
          condition.operator,
        );
      default:
        return false;
    }
  }

  private matchesFilterExpression(
    row: AuditViewRow,
    conditions: AuditFilterCondition[],
  ): boolean {
    let currentAndGroupMatches = this.matchesCondition(row, conditions[0]);
    let completedOrGroupMatches = false;

    for (const condition of conditions.slice(1)) {
      const conditionMatches = this.matchesCondition(row, condition);

      if (condition.join === "OR") {
        completedOrGroupMatches ||= currentAndGroupMatches;
        currentAndGroupMatches = conditionMatches;
      } else {
        currentAndGroupMatches &&= conditionMatches;
      }
    }

    return completedOrGroupMatches || currentAndGroupMatches;
  }

  private areFilterValuesEqual(
    sourceValue: string,
    filterValue: string,
    fieldType: AuditFieldType,
  ): boolean {
    if (fieldType === "number") {
      return Number(sourceValue) === Number(filterValue);
    }

    if (fieldType === "date") {
      return sourceValue.slice(0, 10) === filterValue.slice(0, 10);
    }

    return sourceValue.toLocaleLowerCase() === filterValue.toLocaleLowerCase();
  }

  private compareOrderedValues(
    sourceValue: string,
    filterValue: string,
    operator: Extract<
      AuditFilterOperator,
      "greaterThan" | "greaterThanOrEqual" | "lessThan" | "lessThanOrEqual"
    >,
  ): boolean {
    const sourceNumber = Number(sourceValue);
    const filterNumber = Number(filterValue);
    let comparison: number;

    if (Number.isFinite(sourceNumber) && Number.isFinite(filterNumber)) {
      comparison = sourceNumber - filterNumber;
    } else if (
      /^\d{4}-\d{2}-\d{2}/.test(sourceValue) &&
      /^\d{4}-\d{2}-\d{2}/.test(filterValue)
    ) {
      const sourceDate = Date.parse(sourceValue);
      const filterDate = Date.parse(filterValue);
      comparison =
        Number.isFinite(sourceDate) && Number.isFinite(filterDate)
          ? sourceDate - filterDate
          : sourceValue.localeCompare(filterValue, undefined, {
              numeric: true,
              sensitivity: "base",
            });
    } else {
      comparison = sourceValue.localeCompare(filterValue, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    }

    switch (operator) {
      case "greaterThan":
        return comparison > 0;
      case "greaterThanOrEqual":
        return comparison >= 0;
      case "lessThan":
        return comparison < 0;
      default:
        return comparison <= 0;
    }
  }

  private toViewRow(record: DynamicAuditRecord): AuditViewRow {
    return {
      id: record.id,
      values: record.originalData ?? {},
      revisionCount: record.changeSummary.totalRevisions,
      recordState: record.originalRecordPresent ? "Current" : "Audit only",
      auditHistory: record.auditHistory,
      historyColumns: this.createColumns([record], "auditHistory"),
    };
  }

  private createColumns(
    records: DynamicAuditRecord[],
    source: "originalData" | "auditHistory",
  ): AuditViewColumn[] {
    const keys = new Set<string>();
    const exclusions =
      source === "originalData"
        ? this.mainColumnExclusions
        : this.historyColumnExclusions;

    for (const record of records) {
      const dataItems =
        source === "originalData"
          ? record.originalData
            ? [record.originalData]
            : []
          : record.auditHistory;

      for (const dataItem of dataItems) {
        for (const key of Object.keys(dataItem)) {
          if (!exclusions.has(key)) {
            keys.add(key);
          }
        }
      }
    }

    return Array.from(keys, (key) => ({
      key,
      label: this.toColumnLabel(key),
      dataType: this.inferColumnType(key, records, source),
    }));
  }

  private inferColumnType(
    key: string,
    records: DynamicAuditRecord[],
    source: "originalData" | "auditHistory",
  ): AuditFieldType {
    const values: AuditCellValue[] = [];

    for (const record of records) {
      const dataItems =
        source === "originalData"
          ? record.originalData
            ? [record.originalData]
            : []
          : record.auditHistory;

      for (const dataItem of dataItems) {
        values.push(dataItem[key] ?? null);
      }
    }

    const sampleValue = values.find((value) => value !== null);

    if (typeof sampleValue === "number") {
      return "number";
    }

    if (typeof sampleValue === "boolean") {
      return "boolean";
    }

    if (
      typeof sampleValue === "string" &&
      (/(_DATE|_ON|_AT|_UPDATED|TIMESTAMP)$/.test(key) ||
        /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(sampleValue))
    ) {
      return "date";
    }

    return "text";
  }

  private toColumnLabel(key: string): string {
    return key
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((word) => {
        if (/^[A-Z0-9]+$/.test(word) && word.length <= 3) {
          return word;
        }

        const normalizedWord = word.toLocaleLowerCase();
        return `${normalizedWord.charAt(0).toLocaleUpperCase()}${normalizedWord.slice(1)}`;
      })
      .join(" ");
  }
}
