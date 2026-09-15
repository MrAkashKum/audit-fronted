export type AuditOperation = 'INSERT' | 'UPDATE' | 'DELETE' | 'UNKNOWN';

export interface AuditApiResponse {
  timestamp: string;
  status: string;
  code: string;
  message: string;
  data: AuditPage;
}

export interface AuditPage {
  pageNo: number;
  pageSize: number;
  numberOfElements: number;
  totalElements: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  rows: AuditRecord[];
}

export interface AuditRecord {
  id: number;
  originalRecordPresent: boolean;
  originalData: OriginalAuditData;
  changeSummary: ChangeSummary;
  auditHistory: AuditHistoryEntry[];
}

export interface OriginalAuditData {
  ID: number;
  CREATED_BY: string | null;
  CREATED_ON: string | null;
  UPDATED_BY: string | null;
  UPDATED_ON: string | null;
  VERSION: number;
  ACCOUNT_IDENTIFICATION: number;
  BASE_UOM: string;
  LAST_LEDGER_ID_PROCESSED: number;
  METAL_CODE: string;
  TOTAL_AGGREGATED_QUANTITY: number;
}

export interface ChangeSummary {
  totalRevisions: number;
  insertCount: number;
  updateCount: number;
  deleteCount: number;
  unknownCount: number;
  firstRevision: number;
  latestRevision: number;
}

export interface AuditHistoryEntry {
  sequenceNumber: number;
  revision: number;
  revisionTypeCode: number;
  operation: AuditOperation;
  ID: number;
  REV: number;
  REVTYPE: number;
  CREATED_BY: string | null;
  CREATED_ON: string | null;
  UPDATED_BY: string | null;
  UPDATED_ON: string | null;
  ACCOUNT_IDENTIFICATION: number;
  BASE_UOM: string;
  LAST_LEDGER_ID_PROCESSED: number;
  METAL_CODE: string;
  TOTAL_AGGREGATED_QUANTITY: number;
}
