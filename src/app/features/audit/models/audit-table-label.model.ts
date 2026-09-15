export interface AuditTableLabelsApiResponse {
  timestamp: string;
  message: string;
  data: AuditTableLabelsData;
}

export interface AuditTableLabelsData {
  tableLabels: string[];
}
