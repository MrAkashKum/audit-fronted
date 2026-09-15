import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';

import { AuditApiResponse } from '../models/audit-record.model';
import { AuditTableLabelsApiResponse } from '../models/audit-table-label.model';
import { DynamicAuditApiResponse } from '../models/audit-view.model';

@Injectable({
  providedIn: 'root',
})
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly auditApiUrl = 'data/audit-records.json';
  private readonly auditTableLabelsApiUrl = '/api/v1/allTable';
  private readonly auditTableLabelsFallbackUrl = 'data/audit-table-labels.json';

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

    return this.http
      .get<DynamicAuditApiResponse>(sourceUrl, { params })
      .pipe(map((response) => this.createFixturePage(response, pageNo, pageSize)));
  }

  getAuditTableLabels(): Observable<AuditTableLabelsApiResponse> {
    return this.http
      .get<AuditTableLabelsApiResponse>(this.auditTableLabelsApiUrl)
      .pipe(
        catchError(() =>
          this.http.get<AuditTableLabelsApiResponse>(this.auditTableLabelsFallbackUrl),
        ),
      );
  }

  private toFileSlug(tableLabel: string): string {
    return tableLabel
      .trim()
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * The current endpoints are static JSON fixtures, so the browser must apply the
   * requested page metadata locally. Remove this adapter when sourceUrl is replaced
   * by a backend endpoint that already performs server-side pagination.
   */
  private createFixturePage(
    response: DynamicAuditApiResponse,
    requestedPageNo: number,
    requestedPageSize: number,
  ): DynamicAuditApiResponse {
    const allRows = response.data.rows;
    const totalElements = allRows.length;
    const totalPages = totalElements === 0 ? 0 : Math.ceil(totalElements / requestedPageSize);
    const pageNo = totalPages === 0 ? 0 : Math.min(Math.max(requestedPageNo, 0), totalPages - 1);
    const startIndex = pageNo * requestedPageSize;
    const rows = allRows.slice(startIndex, startIndex + requestedPageSize);

    return {
      ...response,
      data: {
        ...response.data,
        pageNo,
        pageSize: requestedPageSize,
        numberOfElements: rows.length,
        totalElements,
        totalPages,
        hasPrevious: pageNo > 0,
        hasNext: pageNo < totalPages - 1,
        rows,
      },
    };
  }
}
