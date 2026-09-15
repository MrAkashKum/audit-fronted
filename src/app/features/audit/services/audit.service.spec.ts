import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";

import { AuditTableLabelsApiResponse } from "../models/audit-table-label.model";
import { DynamicAuditApiResponse } from "../models/audit-view.model";
import { AuditService } from "./audit.service";

const labelsResponse: AuditTableLabelsApiResponse = {
  timestamp: "2026-09-14T04:30:00Z",
  message: "Request completed successfully",
  data: {
    tableLabels: ["Holiday-Calendar", "Loco-Singapore", "Position-Balance"],
  },
};

const recordsResponse: DynamicAuditApiResponse = {
  timestamp: "2026-09-14T09:25:00Z",
  message: "Request completed successfully",
  data: {
    pageNo: 2,
    pageSize: 25,
    numberOfElements: 0,
    totalElements: 75,
    totalPages: 3,
    hasPrevious: true,
    hasNext: false,
    rows: [],
  },
};

describe("AuditService", () => {
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

  it("returns a cold observable for the audit table-label endpoint", () => {
    const response$ = service.getAuditTableLabels();
    let tableLabels: string[] = [];

    httpTesting.expectNone("/api/v1/audit/allTable");

    response$.subscribe((response) => {
      tableLabels = response.data.tableLabels;
    });

    const request = httpTesting.expectOne("/api/v1/audit/allTable");
    expect(request.request.method).toBe("GET");
    request.flush(labelsResponse);

    expect(tableLabels).toEqual(labelsResponse.data.tableLabels);
  });

  it("requests the selected audit table with encoded label and dynamic pagination", () => {
    let totalElements = 0;

    service.getAuditRecords("Holiday-Calendar", 2, 25).subscribe((response) => {
      totalElements = response.data.totalElements;
    });

    const request = httpTesting.expectOne(
      (candidate) => candidate.url === "/api/v1/audit/Holiday-Calendar",
    );
    expect(request.request.method).toBe("GET");
    expect(request.request.params.get("pageNo")).toBe("2");
    expect(request.request.params.get("pageSize")).toBe("25");
    request.flush(recordsResponse);

    expect(totalElements).toBe(75);
  });

  it("uses the default pagination values", () => {
    service.getAuditRecords("Position-Balance").subscribe();

    const request = httpTesting.expectOne(
      (candidate) => candidate.url === "/api/v1/audit/Position-Balance",
    );
    expect(request.request.params.get("pageNo")).toBe("0");
    expect(request.request.params.get("pageSize")).toBe("10");
    request.flush({
      ...recordsResponse,
      data: {
        ...recordsResponse.data,
        pageNo: 0,
        pageSize: 10,
      },
    });
  });

  it("normalizes invalid pagination before calling the API", () => {
    service.getAuditRecords("Loco-Singapore", -4, 0.5).subscribe();

    const request = httpTesting.expectOne(
      (candidate) => candidate.url === "/api/v1/audit/Loco-Singapore",
    );
    expect(request.request.params.get("pageNo")).toBe("0");
    expect(request.request.params.get("pageSize")).toBe("10");
    request.flush({
      ...recordsResponse,
      data: {
        ...recordsResponse.data,
        pageNo: 0,
        pageSize: 10,
      },
    });
  });

  it("rejects a blank table label without issuing an HTTP request", () => {
    let errorMessage = "";

    service.getAuditRecords("   ").subscribe({
      error: (error: Error) => {
        errorMessage = error.message;
      },
    });

    expect(errorMessage).toBe("An audit table label is required.");
    httpTesting.expectNone((request) =>
      request.url.startsWith("/api/v1/audit/"),
    );
  });

  it("propagates API errors and never requests a local fallback", () => {
    let responseStatus = 0;

    service.getAuditTableLabels().subscribe({
      error: (error: { status: number }) => {
        responseStatus = error.status;
      },
    });

    const request = httpTesting.expectOne("/api/v1/audit/allTable");
    request.flush("Unable to load tables", {
      status: 500,
      statusText: "Server Error",
    });

    expect(responseStatus).toBe(500);
    httpTesting.expectNone((candidate) => candidate.url.startsWith("data/"));
  });
});
