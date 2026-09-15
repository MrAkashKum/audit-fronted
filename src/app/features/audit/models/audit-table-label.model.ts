export interface AuditTableLabelsApiResponse {
  timestamp: string;
  status: string;
  code: string;
  message: string;
  data: AuditTableLabelsData;
}

export interface AuditTableLabelsData {
  tableLabels: string[];
}
