import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, Subject } from 'rxjs';

import { AuditTableLabelsApiResponse } from '../../models/audit-table-label.model';
import { AuditFilterCondition, DynamicAuditApiResponse } from '../../models/audit-view.model';
import { AuditService } from '../../services/audit.service';
import { AuditView } from './audit-view';

interface AuditRecordRequest {
  tableLabel: string;
  pageNo: number;
  pageSize: number;
}

const createResponse = (
  id: number,
  originalData: Record<string, string | number | boolean | null>,
  auditData: Record<string, string | number | boolean | null>,
): DynamicAuditApiResponse => ({
  timestamp: '2026-09-14T09:25:00Z',
  status: 'SUCCESS',
  code: '2000',
  message: 'Request completed successfully',
  data: {
    pageNo: 0,
    pageSize: 10,
    numberOfElements: 1,
    totalElements: 1,
    totalPages: 1,
    hasPrevious: false,
    hasNext: false,
    rows: [
      {
        id,
        originalRecordPresent: true,
        originalData: { ID: id, ...originalData },
        changeSummary: {
          totalRevisions: 1,
          insertCount: 1,
          updateCount: 0,
          deleteCount: 0,
          unknownCount: 0,
          firstRevision: 9401,
          latestRevision: 9401,
        },
        auditHistory: [
          {
            sequenceNumber: 1,
            revision: 9401,
            revisionTypeCode: 0,
            operation: 'INSERT',
            ID: id,
            REV: 9401,
            REVTYPE: 0,
            ...auditData,
          },
        ],
      },
    ],
  },
});

const holidayResponse = createResponse(
  3001,
  {
    HOLIDAY_DATE: '2026-08-09',
    CALENDAR_CODE: 'SG',
    CALENDAR_NAME: 'Singapore Public Holidays',
  },
  {
    HOLIDAY_DATE: '2026-08-09',
    CALENDAR_CODE: 'SG',
    CALENDAR_NAME: 'Singapore Public Holidays',
    HOLIDAY_NAME: 'National Day',
  },
);

const locomotiveResponse = createResponse(
  2001,
  {
    LOCOMOTIVE_CODE: 'SG-L-001',
    LOCOMOTIVE_NAME: 'Merlion One',
    DEPOT_CODE: 'TJS',
    FLEET_STATUS: 'AVAILABLE',
    LAST_UPDATED: '2026-08-28T09:35:12Z',
  },
  {
    LOCOMOTIVE_CODE: 'SG-L-001',
    LOCOMOTIVE_NAME: 'Merlion One',
    DEPOT_CODE: 'TJS',
    COUNTRY_CODE: 'SG',
    FLEET_STATUS: 'AVAILABLE',
    MODEL: 'C30-7',
  },
);

const locomotiveRecord = locomotiveResponse.data.rows[0];
const firstLocomotiveRevision = locomotiveRecord.auditHistory[0];
locomotiveRecord.changeSummary.totalRevisions = 2;
locomotiveRecord.changeSummary.updateCount = 1;
locomotiveRecord.changeSummary.latestRevision = 9450;
locomotiveRecord.auditHistory.push({
  ...firstLocomotiveRevision,
  sequenceNumber: 2,
  revision: 9450,
  revisionTypeCode: 1,
  operation: 'UPDATE',
  REV: 9450,
  REVTYPE: 1,
});

const labelsResponse: AuditTableLabelsApiResponse = {
  timestamp: '2026-09-14T04:30:00Z',
  status: 'SUCCESS',
  code: '2000',
  message: 'Request completed successfully',
  data: {
    tableLabels: ['Holiday Calendar', 'Loco Singapore', 'Position Balance'],
  },
};

describe('AuditView', () => {
  let recordRequests: AuditRecordRequest[];
  let recordsResponseOverride: Observable<DynamicAuditApiResponse> | null;
  let labelsResponseOverride: Observable<AuditTableLabelsApiResponse> | null;

  beforeEach(async () => {
    recordRequests = [];
    recordsResponseOverride = null;
    labelsResponseOverride = null;

    await TestBed.configureTestingModule({
      imports: [AuditView],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: AuditService,
          useValue: {
            getAuditRecordsForTable: (tableLabel: string, pageNo = 0, pageSize = 10) => {
              recordRequests.push({ tableLabel, pageNo, pageSize });
              const source = tableLabel === 'Loco Singapore' ? locomotiveResponse : holidayResponse;
              const totalElements = tableLabel === 'Loco Singapore' ? 21 : 1;
              const totalPages = Math.max(Math.ceil(totalElements / pageSize), 1);

              const response: DynamicAuditApiResponse = {
                ...source,
                data: {
                  ...source.data,
                  pageNo,
                  pageSize,
                  totalElements,
                  totalPages,
                  hasPrevious: pageNo > 0,
                  hasNext: pageNo < totalPages - 1,
                },
              };

              return recordsResponseOverride ?? of(response);
            },
            getAuditTableLabels: () => labelsResponseOverride ?? of(labelsResponse),
          },
        },
      ],
    }).compileComponents();
  });

  async function createFixture(): Promise<ComponentFixture<AuditView>> {
    const fixture = TestBed.createComponent(AuditView);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  async function selectTable(
    fixture: ComponentFixture<AuditView>,
    tableLabel: string,
  ): Promise<void> {
    const element = fixture.nativeElement as HTMLElement;
    fixture.componentInstance.isTableMenuOpen = true;
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();

    const option = Array.from(element.querySelectorAll<HTMLButtonElement>('.table-option')).find(
      (candidate) => candidate.textContent?.includes(tableLabel),
    );

    expect(option).toBeDefined();
    option?.click();
    await fixture.whenStable();
  }

  it('loads labels only and waits for the user to choose a table', async () => {
    const fixture = await createFixture();
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.selectedTableLabel).toBe('');
    expect(recordRequests).toEqual([]);
    expect(element.querySelector('.empty-selection')?.textContent).toContain(
      'Choose an audit table',
    );
    expect(element.querySelector('.records-panel')).toBeNull();
  });

  it('renders asynchronously loaded labels without requiring another user action', async () => {
    const labelsSubject = new Subject<AuditTableLabelsApiResponse>();
    labelsResponseOverride = labelsSubject.asObservable();
    const fixture = await createFixture();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.table-count')?.textContent).toContain('0 tables');

    labelsSubject.next(labelsResponse);
    labelsSubject.complete();
    await fixture.whenStable();

    expect(element.querySelector('.table-count')?.textContent).toContain('3 tables');
  });

  it('renders asynchronously loaded records without requiring another user action', async () => {
    const recordsSubject = new Subject<DynamicAuditApiResponse>();
    recordsResponseOverride = recordsSubject.asObservable();
    const fixture = await createFixture();
    const element = fixture.nativeElement as HTMLElement;

    await selectTable(fixture, 'Holiday Calendar');
    expect(element.querySelector('.panel-state')?.textContent).toContain('Loading audit records');

    recordsSubject.next(holidayResponse);
    recordsSubject.complete();
    await fixture.whenStable();

    expect(element.querySelector('.panel-state')).toBeNull();
    expect(element.querySelector('.record-id')?.textContent).toContain('#3001');
  });

  it('changes the record and history schemas when a table is selected', async () => {
    const fixture = await createFixture();
    const component = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;

    await selectTable(fixture, 'Loco Singapore');

    expect(recordRequests.at(-1)).toEqual({
      tableLabel: 'Loco Singapore',
      pageNo: 0,
      pageSize: 10,
    });
    expect(component.columns.map((column) => column.label)).toEqual([
      'Locomotive',
      'Name',
      'Depot',
      'Fleet Status',
      'Last Updated',
    ]);
    expect(element.querySelector('.record-id')?.textContent).toContain('#2001');

    (element.querySelector('.expand-button') as HTMLButtonElement).click();
    await fixture.whenStable();

    const historyText = element.querySelector('.history-row')?.textContent;
    expect(component.rows[0].historyColumns.map((column) => column.label)).toContain(
      'Locomotive Code',
    );
    expect(historyText).toContain('Country Code');
    expect(historyText).toContain('#9401');
    expect(historyText).toContain('SG-L-001');
  });

  it('searches visible table names and supports keyboard selection', async () => {
    const fixture = await createFixture();
    const component = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;
    const search = element.querySelector('#audit-view-table-search') as HTMLInputElement;

    search.value = 'Singapore locomotives';
    search.dispatchEvent(new Event('input'));
    expect(component.filteredTableLabels).toEqual(['Loco Singapore']);

    component.clearTableSearch();
    expect(component.tableSearchQuery).toBe('');
    expect(component.filteredTableLabels).toHaveLength(3);

    search.value = 'Singapore locomotives';
    search.dispatchEvent(new Event('input'));
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();

    expect(component.selectedTableLabel).toBe('Loco Singapore');
    expect(component.getTableInitials('Loco Singapore')).toBe('SG');
    expect(recordRequests.at(-1)?.tableLabel).toBe('Loco Singapore');
    expect(document.title).toBe('Singapore locomotives | Audit Frontend');
  });

  it('sorts record fields in ascending, descending, and original order', async () => {
    const fixture = await createFixture();
    const component = fixture.componentInstance;

    await selectTable(fixture, 'Loco Singapore');

    const originalRow = component.rows[0];
    component.rows = [
      {
        ...originalRow,
        id: 2002,
        values: { ...originalRow.values, LOCOMOTIVE_CODE: 'SG-L-002' },
      },
      {
        ...originalRow,
        id: 1998,
        values: { ...originalRow.values, LOCOMOTIVE_CODE: 'SG-L-LEGACY' },
      },
    ];

    component.toggleSort('ID');
    expect(component.filteredRows.map((row) => row.id)).toEqual([1998, 2002]);
    expect(component.getAriaSort('ID')).toBe('ascending');

    component.toggleSort('ID');
    expect(component.filteredRows.map((row) => row.id)).toEqual([2002, 1998]);
    expect(component.getAriaSort('ID')).toBe('descending');

    component.toggleSort('ID');
    expect(component.filteredRows.map((row) => row.id)).toEqual([2002, 1998]);
    expect(component.getAriaSort('ID')).toBeNull();
  });

  it('shows expansion only when a record has multiple revisions', async () => {
    const fixture = await createFixture();
    const component = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;

    await selectTable(fixture, 'Loco Singapore');
    expect(element.querySelector('.expand-button')).not.toBeNull();

    component.rows = [
      {
        ...component.rows[0],
        revisionCount: 1,
        auditHistory: [component.rows[0].auditHistory[0]],
      },
    ];
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();

    expect(component.canExpandRow(component.rows[0])).toBe(false);
    expect(element.querySelector('.expand-button')).toBeNull();

    component.toggleRow(2001);
    component.toggleRow(2002);
    expect(component.isRowExpanded(2001)).toBe(false);
    expect(component.isRowExpanded(2002)).toBe(true);
  });

  it('exposes expanded history as a keyboard-scrollable region', async () => {
    const fixture = await createFixture();
    const element = fixture.nativeElement as HTMLElement;

    await selectTable(fixture, 'Loco Singapore');
    (element.querySelector('.expand-button') as HTMLButtonElement).click();
    await fixture.whenStable();

    const historyScroller = element.querySelector('.history-table-wrap') as HTMLElement;

    expect(historyScroller).not.toBeNull();
    expect(historyScroller.getAttribute('role')).toBe('region');
    expect(historyScroller.getAttribute('tabindex')).toBe('0');
    expect(historyScroller.getAttribute('aria-label')).toBe('Audit history for record 2001');
  });

  it('offers source fields only and applies typed AND/OR conditions', async () => {
    const fixture = await createFixture();
    const component = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;

    await selectTable(fixture, 'Loco Singapore');
    (element.querySelector('.filter-button') as HTMLButtonElement).click();
    await fixture.whenStable();

    const fieldKeys = component.filterFields.map((field) => field.key);
    (element.querySelector('.field-trigger') as HTMLButtonElement).click();
    await fixture.whenStable();
    const fieldOptions = element.querySelector('.field-options')?.textContent;

    expect(fieldKeys).toContain('ID');
    expect(fieldKeys).toContain('LOCOMOTIVE_CODE');
    expect(fieldKeys).not.toContain('COUNTRY_CODE');
    expect(fieldKeys).not.toContain('MODEL');
    expect(fieldOptions).not.toContain('Country Code');
    expect(component.columns.find((column) => column.key === 'LAST_UPDATED')?.dataType).toBe(
      'date',
    );

    const conditions: AuditFilterCondition[] = [
      {
        id: 1,
        join: 'AND',
        fieldKey: 'LOCOMOTIVE_CODE',
        operator: 'contains',
        value: '001',
      },
      {
        id: 2,
        join: 'AND',
        fieldKey: 'DEPOT_CODE',
        operator: 'equals',
        value: 'PSA',
      },
    ];

    component.filterConditions = conditions;
    expect(component.filteredRows).toHaveLength(0);

    conditions[1].join = 'OR';
    expect(component.filteredRows).toHaveLength(1);

    component.filterConditions = [
      {
        id: 3,
        join: 'AND',
        fieldKey: 'LOCOMOTIVE_CODE',
        operator: 'contains',
        value: '001',
      },
      {
        id: 4,
        join: 'OR',
        fieldKey: 'DEPOT_CODE',
        operator: 'equals',
        value: 'PSA',
      },
      {
        id: 5,
        join: 'AND',
        fieldKey: 'FLEET_STATUS',
        operator: 'equals',
        value: 'RETIRED',
      },
    ];
    expect(component.filteredRows).toHaveLength(1);

    component.filterConditions = [
      {
        id: 6,
        join: 'AND',
        fieldKey: 'ID',
        operator: 'greaterThan',
        value: '2000',
      },
    ];
    expect(component.filteredRows).toHaveLength(1);

    component.filterConditions = [
      {
        id: 7,
        join: 'AND',
        fieldKey: 'LAST_UPDATED',
        operator: 'equals',
        value: '2026-08-28',
      },
    ];
    expect(component.filteredRows).toHaveLength(1);
  });

  it('keeps condition and value enabled and preserves them when a field is selected', async () => {
    const fixture = await createFixture();
    const element = fixture.nativeElement as HTMLElement;

    await selectTable(fixture, 'Holiday Calendar');
    (element.querySelector('.filter-button') as HTMLButtonElement).click();
    await fixture.whenStable();

    let fieldTrigger = element.querySelector('.field-trigger') as HTMLButtonElement;
    let operatorTrigger = element.querySelector('.operator-trigger') as HTMLButtonElement;
    let valueInput = element.querySelector('.filter-value input') as HTMLInputElement;

    expect(operatorTrigger.disabled).toBe(false);
    expect(valueInput.disabled).toBe(false);

    operatorTrigger.click();
    await fixture.whenStable();

    expect(element.querySelectorAll('.operator-option')).toHaveLength(10);
    (element.querySelector('[data-operator="startsWith"]') as HTMLButtonElement).click();
    valueInput.value = 'SG';
    valueInput.dispatchEvent(new Event('input'));

    fieldTrigger.click();
    await fixture.whenStable();
    (element.querySelector('[data-field="CALENDAR_CODE"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    fieldTrigger = element.querySelector('.field-trigger') as HTMLButtonElement;
    operatorTrigger = element.querySelector('.operator-trigger') as HTMLButtonElement;
    valueInput = element.querySelector('.filter-value input') as HTMLInputElement;

    expect(operatorTrigger.disabled).toBe(false);
    expect(fieldTrigger.textContent).toContain('Calendar');
    expect(valueInput.disabled).toBe(false);
    expect(operatorTrigger.textContent).toContain('Starts with');
    expect(fixture.componentInstance.filterConditions[0].operator).toBe('startsWith');
    expect(valueInput.value).toBe('SG');
    expect(fixture.componentInstance.filteredRows).toHaveLength(1);

    valueInput.value = 'missing-calendar';
    valueInput.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(element.querySelector('.panel-state')?.textContent).toContain('No matching records');
  });

  it('supports keyboard selection in the custom field menu', async () => {
    const fixture = await createFixture();
    const element = fixture.nativeElement as HTMLElement;

    await selectTable(fixture, 'Holiday Calendar');
    (element.querySelector('.filter-button') as HTMLButtonElement).click();
    await fixture.whenStable();

    const fieldTrigger = element.querySelector('.field-trigger') as HTMLButtonElement;
    fieldTrigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await fixture.whenStable();

    expect(fieldTrigger.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelectorAll('.field-option')).toHaveLength(5);

    fieldTrigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fieldTrigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();

    expect(fixture.componentInstance.filterConditions[0].fieldKey).toBe('ID');
    expect(element.querySelector('.field-options')).toBeNull();
    expect(fieldTrigger.textContent).toContain('ID');
  });

  it('supports keyboard selection in the custom condition menu', async () => {
    const fixture = await createFixture();
    const element = fixture.nativeElement as HTMLElement;

    await selectTable(fixture, 'Holiday Calendar');
    (element.querySelector('.filter-button') as HTMLButtonElement).click();
    await fixture.whenStable();

    const operatorTrigger = element.querySelector('.operator-trigger') as HTMLButtonElement;
    operatorTrigger.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    await fixture.whenStable();

    expect(operatorTrigger.getAttribute('aria-expanded')).toBe('true');

    operatorTrigger.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    operatorTrigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();

    expect(fixture.componentInstance.filterConditions[0].operator).toBe('equals');
    expect(element.querySelector('.operator-options')).toBeNull();
    expect(operatorTrigger.textContent).toContain('Equals');
  });

  it('keeps the AND or OR join independent for every added condition', async () => {
    const fixture = await createFixture();
    const component = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;

    await selectTable(fixture, 'Holiday Calendar');
    (element.querySelector('.filter-button') as HTMLButtonElement).click();
    await fixture.whenStable();

    const addConditionButton = element.querySelector('.add-condition') as HTMLButtonElement;
    addConditionButton.click();
    addConditionButton.click();
    await fixture.whenStable();

    const joinControls = element.querySelectorAll<HTMLElement>('.condition-join-toggle');
    expect(joinControls).toHaveLength(2);

    (joinControls[0].querySelector('[data-join="OR"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(component.filterConditions.map((condition) => condition.join)).toEqual([
      'AND',
      'OR',
      'AND',
    ]);
    expect(joinControls[0].querySelector('[data-join="OR"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(joinControls[1].querySelector('[data-join="AND"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(element.querySelector('.match-control')).toBeNull();
  });

  it('requests dynamic pages and resets page zero when page size changes', async () => {
    const fixture = await createFixture();
    const component = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;

    await selectTable(fixture, 'Loco Singapore');

    (element.querySelector('[aria-label="Next page"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(recordRequests.at(-1)).toEqual({
      tableLabel: 'Loco Singapore',
      pageNo: 1,
      pageSize: 10,
    });
    expect(component.currentPageNo).toBe(1);
    expect(
      element.querySelector('.pagination > span')?.textContent?.replace(/\s+/g, ' '),
    ).toContain('11 – 11 of 21');

    const pageSizeSelect = element.querySelector('#items-per-page') as HTMLSelectElement;
    pageSizeSelect.value = '25';
    pageSizeSelect.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(recordRequests.at(-1)).toEqual({
      tableLabel: 'Loco Singapore',
      pageNo: 0,
      pageSize: 25,
    });
    expect(component.currentPageNo).toBe(0);
    expect(component.itemsPerPage).toBe(25);
    expect(Array.from(pageSizeSelect.options, (option) => option.value)).toEqual([
      '10',
      '25',
      '50',
      '100',
    ]);

    await selectTable(fixture, 'Holiday Calendar');
    expect(recordRequests.at(-1)).toEqual({
      tableLabel: 'Holiday Calendar',
      pageNo: 0,
      pageSize: 25,
    });
  });

  it('returns to the choose-table state when refreshed', async () => {
    const fixture = await createFixture();
    const element = fixture.nativeElement as HTMLElement;

    await selectTable(fixture, 'Holiday Calendar');
    (element.querySelector('.refresh-button') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(fixture.componentInstance.selectedTableLabel).toBe('');
    expect(fixture.componentInstance.filterConditions).toEqual([]);
    expect(document.title).toBe('Audit tables | Audit Frontend');
    expect(element.querySelector('.empty-selection')?.textContent).toContain(
      'Choose an audit table',
    );
    expect(element.querySelector('.records-panel')).toBeNull();
  });
});
