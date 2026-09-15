import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuditService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads the audit response from the JSON API', () => {
    let responseStatus = '';

    service.getAuditRecords().subscribe((response) => {
      responseStatus = response.status;
    });

    const request = httpTesting.expectOne('data/audit-records.json');
    expect(request.request.method).toBe('GET');

    request.flush({ status: 'SUCCESS' });
    expect(responseStatus).toBe('SUCCESS');
  });

  it('loads the searchable table labels from the allTable API', () => {
    let tableLabels: string[] = [];

    service.getAuditTableLabels().subscribe((response) => {
      tableLabels = response.data.tableLabels;
    });

    const request = httpTesting.expectOne('/api/v1/allTable');
    expect(request.request.method).toBe('GET');

    request.flush({
      data: {
        tableLabels: ['Holiday Calendar', 'Loco Singapore', 'Position Balance'],
      },
    });
    expect(tableLabels).toHaveLength(3);
  });

  it('uses the table-label JSON fallback when the allTable API is unavailable', () => {
    let tableLabels: string[] = [];

    service.getAuditTableLabels().subscribe((response) => {
      tableLabels = response.data.tableLabels;
    });

    const apiRequest = httpTesting.expectOne('/api/v1/allTable');
    apiRequest.flush('Unable to load tables', {
      status: 500,
      statusText: 'Server Error',
    });

    const fallbackRequest = httpTesting.expectOne('data/audit-table-labels.json');
    expect(fallbackRequest.request.method).toBe('GET');
    fallbackRequest.flush({
      data: {
        tableLabels: ['Holiday Calendar', 'Loco Singapore', 'Position Balance'],
      },
    });

    expect(tableLabels).toHaveLength(3);
  });

  it('selects a table-specific audit JSON source', () => {
    service.getAuditRecordsForTable('Holiday Calendar', 2, 25).subscribe();

    const request = httpTesting.expectOne(
      (candidate) => candidate.url === 'data/audit-records-holiday-calendar.json',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('pageNo')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('25');
    request.flush({ data: { rows: [] } });
  });

  it('uses the original audit JSON for Position Balance', () => {
    service.getAuditRecordsForTable('Position Balance').subscribe();

    const request = httpTesting.expectOne(
      (candidate) => candidate.url === 'data/audit-records.json',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('pageNo')).toBe('0');
    expect(request.request.params.get('pageSize')).toBe('10');
    request.flush({ data: { rows: [] } });
  });

  it('applies requested pagination metadata to static JSON fixtures', () => {
    let pageNo = -1;
    let pageSize = -1;
    let rowIds: number[] = [];

    service.getAuditRecordsForTable('Position Balance', 1, 2).subscribe((response) => {
      pageNo = response.data.pageNo;
      pageSize = response.data.pageSize;
      rowIds = response.data.rows.map((row) => Number(row.id));
    });

    const request = httpTesting.expectOne(
      (candidate) => candidate.url === 'data/audit-records.json',
    );
    request.flush({
      timestamp: '2026-09-14T09:25:00Z',
      status: 'SUCCESS',
      code: '2000',
      message: 'Request completed successfully',
      data: {
        pageNo: 0,
        pageSize: 10,
        numberOfElements: 3,
        totalElements: 3,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
        rows: [
          { id: 1001, originalData: {}, changeSummary: {}, auditHistory: [] },
          { id: 1002, originalData: {}, changeSummary: {}, auditHistory: [] },
          { id: 1003, originalData: {}, changeSummary: {}, auditHistory: [] },
        ],
      },
    });

    expect(pageNo).toBe(1);
    expect(pageSize).toBe(2);
    expect(rowIds).toEqual([1003]);
  });
});
