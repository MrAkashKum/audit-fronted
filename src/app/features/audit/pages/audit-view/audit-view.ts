import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import { AuditTableLabelsApiResponse } from '../../models/audit-table-label.model';
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
} from '../../models/audit-view.model';
import { AuditService } from '../../services/audit.service';

type AuditSortDirection = 'asc' | 'desc' | '';

const SORT_ID = 'ID';
const SORT_REVISIONS = '__REVISIONS__';
const SORT_RECORD_STATE = '__RECORD_STATE__';

@Component({
  selector: 'app-audit-view',
  templateUrl: './audit-view.html',
  styleUrl: './audit-view.css',
})
export class AuditView implements OnInit, OnDestroy {
  private readonly auditService = inject(AuditService);
  private auditRecordsSubscription?: Subscription;
  private tableLabelsSubscription?: Subscription;
  private nextFilterId = 1;

  private readonly mainColumnExclusions = new Set([
    'ID',
    'CREATED_BY',
    'CREATED_ON',
    'UPDATED_BY',
    'UPDATED_ON',
    'VERSION',
  ]);
  private readonly historyColumnExclusions = new Set([
    'sequenceNumber',
    'revision',
    'revisionTypeCode',
    'operation',
    'ID',
    'REV',
    'REVTYPE',
  ]);
  private readonly columnLabelOverrides: Record<string, string> = {
    ACCOUNT_IDENTIFICATION: 'Account',
    BASE_UOM: 'UOM',
    TOTAL_AGGREGATED_QUANTITY: 'Quantity',
    LAST_LEDGER_ID_PROCESSED: 'Last Ledger',
    LOCOMOTIVE_CODE: 'Locomotive',
    LOCOMOTIVE_NAME: 'Name',
    DEPOT_CODE: 'Depot',
    CALENDAR_CODE: 'Calendar',
  };
  private readonly operatorsByType: Record<AuditFieldType, AuditFilterOperatorOption[]> = {
    text: [
      { value: 'contains', label: 'Contains' },
      { value: 'notContains', label: 'Does not contain' },
      { value: 'equals', label: 'Equals' },
      { value: 'notEquals', label: 'Does not equal' },
      { value: 'startsWith', label: 'Starts with' },
      { value: 'endsWith', label: 'Ends with' },
      { value: 'isEmpty', label: 'Is empty' },
      { value: 'isNotEmpty', label: 'Is not empty' },
    ],
    number: [
      { value: 'equals', label: 'Equals' },
      { value: 'notEquals', label: 'Does not equal' },
      { value: 'greaterThan', label: 'Greater than' },
      { value: 'greaterThanOrEqual', label: 'Greater than or equal' },
      { value: 'lessThan', label: 'Less than' },
      { value: 'lessThanOrEqual', label: 'Less than or equal' },
      { value: 'isEmpty', label: 'Is empty' },
      { value: 'isNotEmpty', label: 'Is not empty' },
    ],
    date: [
      { value: 'equals', label: 'On' },
      { value: 'before', label: 'Before' },
      { value: 'after', label: 'After' },
      { value: 'isEmpty', label: 'Is empty' },
      { value: 'isNotEmpty', label: 'Is not empty' },
    ],
    boolean: [
      { value: 'equals', label: 'Equals' },
      { value: 'notEquals', label: 'Does not equal' },
      { value: 'isEmpty', label: 'Is empty' },
      { value: 'isNotEmpty', label: 'Is not empty' },
    ],
  };

  recordsResponse: DynamicAuditApiResponse | null = null;
  tableLabelsResponse: AuditTableLabelsApiResponse | null = null;
  rows: AuditViewRow[] = [];
  columns: AuditViewColumn[] = [];
  historyColumns: AuditViewColumn[] = [];
  tableLabels: string[] = [];
  filterConditions: AuditFilterCondition[] = [];
  selectedTableLabel = '';
  tableSearchQuery = '';
  filterMatch: AuditFilterMatch = 'AND';
  sortKey = '';
  sortDirection: AuditSortDirection = '';
  itemsPerPage = 10;
  currentPageNo = 0;
  isTableMenuOpen = false;
  activeTableOptionIndex = -1;
  isRecordFilterOpen = false;
  isRecordsLoading = false;
  areTableLabelsLoading = true;
  recordsErrorMessage = '';
  tableLabelsErrorMessage = '';
  readonly expandedRowIds = new Set<string | number>();

  get filteredTableLabels(): string[] {
    const searchTerm = this.tableSearchQuery.trim().toLocaleLowerCase();

    if (!searchTerm) {
      return this.tableLabels;
    }

    return this.tableLabels.filter((label) => {
      const searchableText = `${label} ${this.getTableDisplayName(label)}`.toLocaleLowerCase();
      return searchableText.includes(searchTerm);
    });
  }

  get filterFields(): AuditViewColumn[] {
    const idType: AuditFieldType = this.rows.some((row) => typeof row.id === 'number')
      ? 'number'
      : 'text';

    return [{ key: 'ID', label: 'ID', dataType: idType }, ...this.columns];
  }

  get activeFilterCount(): number {
    return this.filterConditions.filter((condition) => this.isConditionComplete(condition)).length;
  }

  get filteredRows(): AuditViewRow[] {
    const activeConditions = this.filterConditions.filter((condition) =>
      this.isConditionComplete(condition),
    );

    const matchingRows =
      activeConditions.length === 0
        ? this.rows
        : this.rows.filter((row) => {
            const matches = activeConditions.map((condition) =>
              this.matchesCondition(row, condition),
            );
            return this.filterMatch === 'AND' ? matches.every(Boolean) : matches.some(Boolean);
          });

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

    return Math.min(this.currentPageStart + page.numberOfElements - 1, page.totalElements);
  }

  get lastPageNo(): number {
    return Math.max((this.recordsResponse?.data.totalPages ?? 1) - 1, 0);
  }

  ngOnInit(): void {
    this.loadTableLabels();
  }

  loadTableLabels(): void {
    this.tableLabelsSubscription?.unsubscribe();
    this.areTableLabelsLoading = true;
    this.tableLabelsErrorMessage = '';

    this.tableLabelsSubscription = this.auditService.getAuditTableLabels().subscribe({
      next: (response) => {
        this.tableLabelsResponse = response;
        this.tableLabels = response.data.tableLabels;
        this.areTableLabelsLoading = false;
      },
      error: (error: unknown) => {
        console.error('Unable to load audit table labels.', error);
        this.tableLabelsResponse = null;
        this.tableLabels = [];
        this.tableLabelsErrorMessage = 'Unable to load audit tables.';
        this.areTableLabelsLoading = false;
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
    this.recordsErrorMessage = '';
    this.expandedRowIds.clear();

    this.auditRecordsSubscription = this.auditService
      .getAuditRecordsForTable(tableLabel, pageNo, pageSize)
      .subscribe({
        next: (response) => {
          this.recordsResponse = response;
          this.currentPageNo = response.data.pageNo;
          this.itemsPerPage = response.data.pageSize;
          this.columns = this.createColumns(response.data.rows, 'originalData');
          this.historyColumns = this.createColumns(response.data.rows, 'auditHistory');
          this.rows = response.data.rows.map((record) => this.toViewRow(record));
          this.isRecordsLoading = false;
        },
        error: (error: unknown) => {
          console.error('Unable to load audit records for ' + tableLabel + '.', error);
          this.recordsResponse = null;
          this.rows = [];
          this.columns = [];
          this.historyColumns = [];
          this.recordsErrorMessage = 'Unable to load records for ' + tableLabel + '.';
          this.isRecordsLoading = false;
        },
      });
  }

  refresh(): void {
    this.auditRecordsSubscription?.unsubscribe();
    this.selectedTableLabel = '';
    this.tableSearchQuery = '';
    this.isTableMenuOpen = false;
    this.activeTableOptionIndex = -1;
    this.isRecordFilterOpen = false;
    this.currentPageNo = 0;
    this.itemsPerPage = 10;
    this.recordsResponse = null;
    this.rows = [];
    this.columns = [];
    this.historyColumns = [];
    this.recordsErrorMessage = '';
    this.expandedRowIds.clear();
    this.resetFilters();
    this.resetSorting();
    this.loadTableLabels();
  }

  onTableSearch(event: Event): void {
    this.tableSearchQuery = (event.target as HTMLInputElement).value;
    this.isTableMenuOpen = true;
    this.activeTableOptionIndex = this.filteredTableLabels.length > 0 ? 0 : -1;
  }

  onTableSearchFocus(): void {
    this.isTableMenuOpen = true;
    const selectedIndex = this.filteredTableLabels.indexOf(this.selectedTableLabel);
    this.activeTableOptionIndex = selectedIndex >= 0 ? selectedIndex : -1;
  }

  onTableSearchKeydown(event: KeyboardEvent): void {
    const options = this.filteredTableLabels;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.isTableMenuOpen = false;
      this.activeTableOptionIndex = -1;
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.isTableMenuOpen = true;

      if (options.length === 0) {
        this.activeTableOptionIndex = -1;
        return;
      }

      const offset = event.key === 'ArrowDown' ? 1 : -1;
      const startingIndex =
        this.activeTableOptionIndex < 0 ? (offset > 0 ? -1 : 0) : this.activeTableOptionIndex;
      this.activeTableOptionIndex = (startingIndex + offset + options.length) % options.length;
      return;
    }

    if (event.key === 'Enter' && this.isTableMenuOpen && this.activeTableOptionIndex >= 0) {
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
    this.tableSearchQuery = '';
    this.isTableMenuOpen = false;
    this.activeTableOptionIndex = -1;
    this.currentPageNo = 0;
    this.itemsPerPage = 10;
    this.isRecordFilterOpen = false;
    this.resetFilters();
    this.resetSorting();
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
        fieldKey: '',
        operator: 'contains',
        value: '',
      },
    ];
  }

  removeFilterCondition(conditionId: number): void {
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

  onFilterMatchChange(event: Event): void {
    this.filterMatch = (event.target as HTMLSelectElement).value as AuditFilterMatch;
  }

  onFilterFieldChange(condition: AuditFilterCondition, event: Event): void {
    condition.fieldKey = (event.target as HTMLSelectElement).value;
    condition.value = '';
    condition.operator = this.getOperatorOptions(condition)[0]?.value ?? 'contains';
  }

  onFilterOperatorChange(condition: AuditFilterCondition, event: Event): void {
    condition.operator = (event.target as HTMLSelectElement).value as AuditFilterOperator;
  }

  onFilterValueChange(condition: AuditFilterCondition, event: Event): void {
    condition.value = (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  getOperatorOptions(condition: AuditFilterCondition): AuditFilterOperatorOption[] {
    return this.operatorsByType[this.getFilterFieldType(condition.fieldKey)];
  }

  getFilterInputType(condition: AuditFilterCondition): 'text' | 'number' | 'date' {
    const dataType = this.getFilterFieldType(condition.fieldKey);

    if (dataType === 'number') {
      return 'number';
    }

    if (dataType === 'date') {
      return 'date';
    }

    return 'text';
  }

  isBooleanFilter(condition: AuditFilterCondition): boolean {
    return this.getFilterFieldType(condition.fieldKey) === 'boolean';
  }

  hasFilterValueInput(condition: AuditFilterCondition): boolean {
    return condition.operator !== 'isEmpty' && condition.operator !== 'isNotEmpty';
  }

  onItemsPerPageChange(event: Event): void {
    const pageSize = Number((event.target as HTMLSelectElement).value);

    if (!this.selectedTableLabel || !Number.isFinite(pageSize) || pageSize <= 0) {
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

    this.loadAuditRecords(this.selectedTableLabel, targetPage, this.itemsPerPage);
  }

  toggleSort(key: string): void {
    if (this.sortKey !== key) {
      this.sortKey = key;
      this.sortDirection = 'asc';
      return;
    }

    if (this.sortDirection === 'asc') {
      this.sortDirection = 'desc';
      return;
    }

    this.resetSorting();
  }

  getAriaSort(key: string): 'ascending' | 'descending' | null {
    if (this.sortKey !== key || !this.sortDirection) {
      return null;
    }

    return this.sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  getSortIndicator(key: string): string {
    if (this.sortKey !== key || !this.sortDirection) {
      return '';
    }

    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  canExpandRow(row: AuditViewRow): boolean {
    return row.auditHistory.length > 1;
  }

  toggleRow(rowId: string | number): void {
    if (this.expandedRowIds.has(rowId)) {
      this.expandedRowIds.delete(rowId);
      return;
    }

    this.expandedRowIds.add(rowId);
  }

  isRowExpanded(rowId: string | number): boolean {
    return this.expandedRowIds.has(rowId);
  }

  getTableInitials(tableLabel: string): string {
    const initialsByTable: Record<string, string> = {
      'Holiday Calendar': 'HC',
      'Loco Singapore': 'SG',
      'Position Balance': 'PB',
    };

    if (initialsByTable[tableLabel]) {
      return initialsByTable[tableLabel];
    }

    return tableLabel
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toLocaleUpperCase())
      .join('');
  }

  getTableDisplayName(tableLabel: string): string {
    const displayNames: Record<string, string> = {
      'Holiday Calendar': 'Holiday Calendar',
      'Loco Singapore': 'Singapore locomotives',
      'Position Balance': 'Position balances',
    };

    return displayNames[tableLabel] ?? tableLabel;
  }

  getCellValue(row: AuditViewRow, column: AuditViewColumn): AuditCellValue {
    return row.values[column.key] ?? null;
  }

  getHistoryValue(
    history: AuditViewRow['auditHistory'][number],
    column: AuditViewColumn,
  ): AuditCellValue {
    return history[column.key] ?? null;
  }

  formatCellValue(value: AuditCellValue, showNull = false): string {
    if (value === null || value === undefined) {
      return showNull ? 'null' : '—';
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (typeof value === 'number') {
      return value.toLocaleString();
    }

    return value;
  }

  isCodeColumn(columnKey: string): boolean {
    return columnKey.endsWith('_CODE') || columnKey.endsWith('_DATE') || columnKey === 'METAL_CODE';
  }

  isStatusColumn(columnKey: string): boolean {
    return columnKey.includes('STATUS');
  }

  ngOnDestroy(): void {
    this.auditRecordsSubscription?.unsubscribe();
    this.tableLabelsSubscription?.unsubscribe();
  }

  private resetFilters(): void {
    this.filterConditions = [];
    this.filterMatch = 'AND';
    this.nextFilterId = 1;
  }

  private resetSorting(): void {
    this.sortKey = '';
    this.sortDirection = '';
  }

  private sortRows(rows: AuditViewRow[]): AuditViewRow[] {
    if (!this.sortKey || !this.sortDirection) {
      return rows;
    }

    const direction = this.sortDirection === 'asc' ? 1 : -1;

    return [...rows].sort((left, right) => {
      const leftValue = this.getSortValue(left, this.sortKey);
      const rightValue = this.getSortValue(right, this.sortKey);

      if (leftValue === null || leftValue === undefined || leftValue === '') {
        return rightValue === null || rightValue === undefined || rightValue === '' ? 0 : 1;
      }

      if (rightValue === null || rightValue === undefined || rightValue === '') {
        return -1;
      }

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return (leftValue - rightValue) * direction;
      }

      if (typeof leftValue === 'boolean' && typeof rightValue === 'boolean') {
        return (Number(leftValue) - Number(rightValue)) * direction;
      }

      return (
        String(leftValue).localeCompare(String(rightValue), undefined, {
          numeric: true,
          sensitivity: 'base',
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
    return this.filterFields.find((field) => field.key === fieldKey)?.dataType ?? 'text';
  }

  private isConditionComplete(condition: AuditFilterCondition): boolean {
    return (
      Boolean(condition.fieldKey) &&
      (condition.operator === 'isEmpty' ||
        condition.operator === 'isNotEmpty' ||
        condition.value.trim().length > 0)
    );
  }

  private matchesCondition(row: AuditViewRow, condition: AuditFilterCondition): boolean {
    const sourceValue = condition.fieldKey === 'ID' ? row.id : row.values[condition.fieldKey];
    const isEmpty = sourceValue === null || sourceValue === undefined || sourceValue === '';

    if (condition.operator === 'isEmpty') {
      return isEmpty;
    }

    if (condition.operator === 'isNotEmpty') {
      return !isEmpty;
    }

    if (isEmpty) {
      return false;
    }

    const fieldType = this.getFilterFieldType(condition.fieldKey);
    const filterValue = condition.value.trim();

    if (fieldType === 'number') {
      return this.compareNumbers(Number(sourceValue), Number(filterValue), condition.operator);
    }

    if (fieldType === 'date') {
      const sourceDate = String(sourceValue).slice(0, 10);
      const targetDate = filterValue.slice(0, 10);
      return this.compareNumbers(
        Date.parse(sourceDate),
        Date.parse(targetDate),
        condition.operator,
      );
    }

    if (fieldType === 'boolean') {
      const sourceBoolean = String(sourceValue).toLocaleLowerCase() === 'true';
      const filterBoolean = filterValue === 'true';
      return condition.operator === 'notEquals'
        ? sourceBoolean !== filterBoolean
        : sourceBoolean === filterBoolean;
    }

    const sourceText = String(sourceValue).toLocaleLowerCase();
    const targetText = filterValue.toLocaleLowerCase();

    switch (condition.operator) {
      case 'contains':
        return sourceText.includes(targetText);
      case 'notContains':
        return !sourceText.includes(targetText);
      case 'startsWith':
        return sourceText.startsWith(targetText);
      case 'endsWith':
        return sourceText.endsWith(targetText);
      case 'notEquals':
        return sourceText !== targetText;
      default:
        return sourceText === targetText;
    }
  }

  private compareNumbers(
    sourceValue: number,
    filterValue: number,
    operator: AuditFilterOperator,
  ): boolean {
    if (!Number.isFinite(sourceValue) || !Number.isFinite(filterValue)) {
      return false;
    }

    switch (operator) {
      case 'notEquals':
        return sourceValue !== filterValue;
      case 'greaterThan':
      case 'after':
        return sourceValue > filterValue;
      case 'greaterThanOrEqual':
        return sourceValue >= filterValue;
      case 'lessThan':
      case 'before':
        return sourceValue < filterValue;
      case 'lessThanOrEqual':
        return sourceValue <= filterValue;
      default:
        return sourceValue === filterValue;
    }
  }

  private toViewRow(record: DynamicAuditRecord): AuditViewRow {
    return {
      id: record.id,
      values: record.originalData ?? {},
      revisionCount: record.changeSummary.totalRevisions,
      recordState: record.originalRecordPresent ? 'Current' : 'Audit only',
      auditHistory: record.auditHistory,
    };
  }

  private createColumns(
    records: DynamicAuditRecord[],
    source: 'originalData' | 'auditHistory',
  ): AuditViewColumn[] {
    const keys = new Set<string>();
    const exclusions =
      source === 'originalData' ? this.mainColumnExclusions : this.historyColumnExclusions;

    for (const record of records) {
      const dataItems =
        source === 'originalData'
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
      label: this.columnLabelOverrides[key] ?? this.toColumnLabel(key),
      dataType: this.inferColumnType(key, records, source),
    }));
  }

  private inferColumnType(
    key: string,
    records: DynamicAuditRecord[],
    source: 'originalData' | 'auditHistory',
  ): AuditFieldType {
    const values: AuditCellValue[] = [];

    for (const record of records) {
      const dataItems =
        source === 'originalData'
          ? record.originalData
            ? [record.originalData]
            : []
          : record.auditHistory;

      for (const dataItem of dataItems) {
        values.push(dataItem[key] ?? null);
      }
    }

    const sampleValue = values.find((value) => value !== null);

    if (typeof sampleValue === 'number') {
      return 'number';
    }

    if (typeof sampleValue === 'boolean') {
      return 'boolean';
    }

    if (
      typeof sampleValue === 'string' &&
      (/(_DATE|_ON|_AT|_UPDATED|TIMESTAMP)$/.test(key) ||
        /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(sampleValue))
    ) {
      return 'date';
    }

    return 'text';
  }

  private toColumnLabel(key: string): string {
    return key
      .replace(/_/g, ' ')
      .toLocaleLowerCase()
      .replace(/\b\w/g, (character) => character.toLocaleUpperCase());
  }
}
