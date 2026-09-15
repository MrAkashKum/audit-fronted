import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { AuditApiResponse } from '../models/audit-record.model';
import { AuditTableLabelsApiResponse } from '../models/audit-table-label.model';
import { DynamicAuditApiResponse } from '../models/audit-view.model';

@Injectable({
  providedIn: 'root',
})
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly auditApiUrl = 'data/audit-records.json';
  private readonly auditTableLabelsApiUrl = 'data/audit-table-labels.json';

  getAuditRecords(): Observable<AuditApiResponse> {
    return this.http.get<AuditApiResponse>(this.auditApiUrl);
  }

  getAuditRecordsForTable(
    tableLabel: string,
    pageNo = 0,
    pageSize = 10,
  ): Observable<DynamicAuditApiResponse> {
    const sourceUrl =
      tableLabel === 'Position Balance'
        ? this.auditApiUrl
        : `data/audit-records-${this.toFileSlug(tableLabel)}.json`;

    const params = new HttpParams().set('pageNo', pageNo).set('pageSize', pageSize);

    return this.http.get<DynamicAuditApiResponse>(sourceUrl, { params });
  }

  getAuditTableLabels(): Observable<AuditTableLabelsApiResponse> {
    return this.http.get<AuditTableLabelsApiResponse>(this.auditTableLabelsApiUrl);
  }

  private toFileSlug(tableLabel: string): string {
    return tableLabel
      .trim()
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
