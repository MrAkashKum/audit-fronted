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

  it('returns a cold observable for the allTable API request', () => {
    let tableLabels: string[] = [];
    const labelsResponse$ = service.getAuditTableLabels();

    httpTesting.expectNone('/api/v1/allTable');

    labelsResponse$.subscribe((response) => {
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

  it('requests records from the encoded table API with paging parameters', () => {
    let returnedTotalElements = 0;

    service.getAuditRecordsForTable('Holiday Calendar', 2, 25).subscribe((response) => {
      returnedTotalElements = response.data.totalElements;
    });

    const request = httpTesting.expectOne(
      (candidate) => candidate.url === '/api/v1/Holiday%20Calendar',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('pageNo')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('25');
    request.flush({
      data: {
        pageNo: 2,
        pageSize: 25,
        numberOfElements: 0,
        totalElements: 75,
        totalPages: 3,
        hasPrevious: true,
        hasNext: false,
        rows: [],
      },
    });

    expect(returnedTotalElements).toBe(75);
  });

  it('uses the raw encoded label for the Position Balance API', () => {
    service.getAuditRecordsForTable('Position Balance').subscribe();

    const request = httpTesting.expectOne(
      (candidate) => candidate.url === '/api/v1/Position%20Balance',
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

    const apiRequest = httpTesting.expectOne(
      (candidate) => candidate.url === '/api/v1/Position%20Balance',
    );
    apiRequest.flush('Unable to load records', {
      status: 500,
      statusText: 'Server Error',
    });

    const fixtureRequest = httpTesting.expectOne(
      (candidate) => candidate.url === 'data/audit-records.json',
    );
    expect(fixtureRequest.request.params.get('pageNo')).toBe('1');
    expect(fixtureRequest.request.params.get('pageSize')).toBe('2');
    fixtureRequest.flush({
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

  it('normalizes invalid pagination before requesting API and demo records', () => {
    let responsePageNo = -1;
    let responsePageSize = -1;

    service.getAuditRecordsForTable('Holiday Calendar', -4, 0.5).subscribe((response) => {
      responsePageNo = response.data.pageNo;
      responsePageSize = response.data.pageSize;
    });

    const apiRequest = httpTesting.expectOne(
      (candidate) => candidate.url === '/api/v1/Holiday%20Calendar',
    );
    expect(apiRequest.request.params.get('pageNo')).toBe('0');
    expect(apiRequest.request.params.get('pageSize')).toBe('10');
    apiRequest.flush('Unable to load records', {
      status: 500,
      statusText: 'Server Error',
    });

    const fixtureRequest = httpTesting.expectOne(
      (candidate) => candidate.url === 'data/audit-records-holiday-calendar.json',
    );
    expect(fixtureRequest.request.params.get('pageNo')).toBe('0');
    expect(fixtureRequest.request.params.get('pageSize')).toBe('10');

    fixtureRequest.flush({
      timestamp: '2026-09-14T09:25:00Z',
      status: 'SUCCESS',
      code: '2000',
      message: 'Request completed successfully',
      data: {
        pageNo: 0,
        pageSize: 10,
        numberOfElements: 0,
        totalElements: 0,
        totalPages: 0,
        hasPrevious: false,
        hasNext: false,
        rows: [],
      },
    });

    expect(responsePageNo).toBe(0);
    expect(responsePageSize).toBe(10);
  });
});
