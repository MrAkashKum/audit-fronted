import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';

import { AuditApiResponse } from '../models/audit-record.model';
import { AuditTableLabelsApiResponse } from '../models/audit-table-label.model';
import { DynamicAuditApiResponse } from '../models/audit-view.model';

const AUDIT_API_BASE_PATH = '/api/v1';
const AUDIT_API_ENDPOINTS = {
  tableLabels: `${AUDIT_API_BASE_PATH}/allTable`,
  records: (tableLabel: string) => `${AUDIT_API_BASE_PATH}/${encodeURIComponent(tableLabel)}`,
} as const;

const AUDIT_DEMO_BASE_PATH = 'data';
const AUDIT_DEMO_ENDPOINTS = {
  tableLabels: `${AUDIT_DEMO_BASE_PATH}/audit-table-labels.json`,
  positionBalanceRecords: `${AUDIT_DEMO_BASE_PATH}/audit-records.json`,
} as const;

const POSITION_BALANCE_TABLE = 'Position Balance';
const DEFAULT_PAGE_NO = 0;
const DEFAULT_PAGE_SIZE = 10;

@Injectable({
  providedIn: 'root',
})
export class AuditService {
  private readonly http = inject(HttpClient);

  getAuditRecords(): Observable<AuditApiResponse> {
    return this.http.get<AuditApiResponse>(AUDIT_DEMO_ENDPOINTS.positionBalanceRecords);
  }

  getAuditRecordsForTable(
    tableLabel: string,
    pageNo = DEFAULT_PAGE_NO,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Observable<DynamicAuditApiResponse> {
    const requestedPageNo = this.normalizePageNo(pageNo);
    const requestedPageSize = this.normalizePageSize(pageSize);
    const params = new HttpParams({
      fromObject: {
        pageNo: requestedPageNo.toString(),
        pageSize: requestedPageSize.toString(),
      },
    });

    return this.http
      .get<DynamicAuditApiResponse>(AUDIT_API_ENDPOINTS.records(tableLabel), { params })
      .pipe(
        catchError(() =>
          this.http
            .get<DynamicAuditApiResponse>(this.getDemoRecordsUrl(tableLabel), { params })
            .pipe(
              map((response) =>
                this.createFixturePage(response, requestedPageNo, requestedPageSize),
              ),
            ),
        ),
      );
  }

  getAuditTableLabels(): Observable<AuditTableLabelsApiResponse> {
    return this.http
      .get<AuditTableLabelsApiResponse>(AUDIT_API_ENDPOINTS.tableLabels)
      .pipe(
        catchError(() =>
          this.http.get<AuditTableLabelsApiResponse>(AUDIT_DEMO_ENDPOINTS.tableLabels),
        ),
      );
  }

  private getDemoRecordsUrl(tableLabel: string): string {
    if (tableLabel === POSITION_BALANCE_TABLE) {
      return AUDIT_DEMO_ENDPOINTS.positionBalanceRecords;
    }

    return `${AUDIT_DEMO_BASE_PATH}/audit-records-${this.toFileSlug(tableLabel)}.json`;
  }

  private toFileSlug(tableLabel: string): string {
    return tableLabel
      .trim()
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private normalizePageNo(pageNo: number): number {
    return Number.isFinite(pageNo)
      ? Math.max(DEFAULT_PAGE_NO, Math.floor(pageNo))
      : DEFAULT_PAGE_NO;
  }

  private normalizePageSize(pageSize: number): number {
    if (!Number.isFinite(pageSize)) {
      return DEFAULT_PAGE_SIZE;
    }

    const normalizedPageSize = Math.floor(pageSize);
    return normalizedPageSize > 0 ? normalizedPageSize : DEFAULT_PAGE_SIZE;
  }

  /**
   * Static fallback fixtures contain their complete row set, so this adapter applies
   * the requested pagination locally. Successful backend responses bypass it and keep
   * their server-provided page metadata unchanged.
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
