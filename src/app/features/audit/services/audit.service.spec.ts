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

  it('loads the searchable table labels from the JSON API', () => {
    let tableLabels: string[] = [];

    service.getAuditTableLabels().subscribe((response) => {
      tableLabels = response.data.tableLabels;
    });

    const request = httpTesting.expectOne('data/audit-table-labels.json');
    expect(request.request.method).toBe('GET');

    request.flush({
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
});
