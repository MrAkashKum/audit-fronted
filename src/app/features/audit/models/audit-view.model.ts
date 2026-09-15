export type AuditCellValue = string | number | boolean | null;
export type DynamicAuditData = Record<string, AuditCellValue>;
export type AuditRecordState = "Current" | "Audit only";
export type AuditFieldType = "text" | "number" | "date" | "boolean";
export type AuditFilterMatch = "AND" | "OR";
export type AuditFilterOperator =
  | "contains"
  | "startsWith"
  | "equals"
  | "notEquals"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "isEmpty"
  | "isNotEmpty";

export interface DynamicAuditApiResponse {
  timestamp: string;
  message: string;
  data: DynamicAuditPage;
}

export interface DynamicAuditPage {
  pageNo: number;
  pageSize: number;
  numberOfElements: number;
  totalElements: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  rows: DynamicAuditRecord[];
}

export interface DynamicAuditRecord {
  id: string | number;
  originalRecordPresent: boolean;
  originalData: DynamicAuditData | null;
  changeSummary: DynamicChangeSummary;
  auditHistory: DynamicAuditHistoryEntry[];
}

export interface DynamicChangeSummary {
  totalRevisions: number;
  insertCount: number;
  updateCount: number;
  deleteCount: number;
  unknownCount: number;
  firstRevision: number;
  latestRevision: number;
}

export interface DynamicAuditHistoryEntry extends DynamicAuditData {
  sequenceNumber: number;
  revision: number;
  revisionTypeCode: number;
  operation: string;
}

export interface AuditViewColumn {
  key: string;
  label: string;
  dataType: AuditFieldType;
}

export interface AuditFilterCondition {
  id: number;
  join: AuditFilterMatch;
  fieldKey: string;
  operator: AuditFilterOperator;
  value: string;
}

export interface AuditFilterOperatorOption {
  value: AuditFilterOperator;
  label: string;
}

export interface AuditViewRow {
  id: string | number;
  values: DynamicAuditData;
  revisionCount: number;
  recordState: AuditRecordState;
  auditHistory: DynamicAuditHistoryEntry[];
  historyColumns: AuditViewColumn[];
}
