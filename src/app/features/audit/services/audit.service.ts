import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable, throwError } from "rxjs";

import { AuditTableLabelsApiResponse } from "../models/audit-table-label.model";
import { DynamicAuditApiResponse } from "../models/audit-view.model";

const AUDIT_TABLE_LABELS_ENDPOINT = "/api/v1/audit/allTable";
const AUDIT_RECORDS_BASE_PATH = "/api/v1/audit";
const AUDIT_API_ENDPOINTS = {
  tableLabels: AUDIT_TABLE_LABELS_ENDPOINT,
  records: (tableLabel: string) =>
    `${AUDIT_RECORDS_BASE_PATH}/${encodeURIComponent(tableLabel)}`,
} as const;

const DEFAULT_PAGE_NO = 0;
const DEFAULT_PAGE_SIZE = 10;

@Injectable({
  providedIn: "root",
})
export class AuditService {
  private readonly http = inject(HttpClient);

  getAuditTableLabels(): Observable<AuditTableLabelsApiResponse> {
    return this.http.get<AuditTableLabelsApiResponse>(
      AUDIT_API_ENDPOINTS.tableLabels,
    );
  }

  getAuditRecords(
    tableLabel: string,
    pageNo = DEFAULT_PAGE_NO,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Observable<DynamicAuditApiResponse> {
    const normalizedTableLabel = tableLabel.trim();

    if (!normalizedTableLabel) {
      return throwError(() => new Error("An audit table label is required."));
    }

    const params = new HttpParams({
      fromObject: {
        pageNo: this.normalizePageNo(pageNo).toString(),
        pageSize: this.normalizePageSize(pageSize).toString(),
      },
    });

    return this.http.get<DynamicAuditApiResponse>(
      AUDIT_API_ENDPOINTS.records(normalizedTableLabel),
      { params },
    );
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
}
