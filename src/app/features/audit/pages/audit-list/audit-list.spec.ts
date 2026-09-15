import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuditApiResponse } from '../../models/audit-record.model';
import { AuditTableLabelsApiResponse } from '../../models/audit-table-label.model';
import { AuditService } from '../../services/audit.service';
import { AuditList } from './audit-list';

const auditResponse: AuditApiResponse = {
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
};

const tableLabelsResponse: AuditTableLabelsApiResponse = {
  timestamp: '2026-09-14T04:30:00Z',
  status: 'SUCCESS',
  code: '2000',
  message: 'Request completed successfully',
  data: {
    tableLabels: ['Holiday Calendar', 'Loco Singapore', 'Position Balance'],
  },
};

describe('AuditList', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditList],
      providers: [
        {
          provide: AuditService,
          useValue: {
            getAuditRecords: () => of(auditResponse),
            getAuditTableLabels: () => of(tableLabelsResponse),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders and filters subscribed table labels', () => {
    const fixture = TestBed.createComponent(AuditList);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.table-option')).toHaveLength(3);

    const input = fixture.nativeElement.querySelector('#audit-table-search') as HTMLInputElement;
    input.value = 'position';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const matchingOptions = fixture.nativeElement.querySelectorAll('.table-option');
    expect(matchingOptions).toHaveLength(1);
    expect(matchingOptions[0].textContent).toContain('Position balances');
  });
});
