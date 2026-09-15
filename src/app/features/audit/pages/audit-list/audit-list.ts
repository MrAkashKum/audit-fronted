import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import { AuditApiResponse } from '../../models/audit-record.model';
import { AuditService } from '../../services/audit.service';

@Component({
  selector: 'app-audit-list',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './audit-list.html',
  styleUrl: './audit-list.css',
})
export class AuditList implements OnInit, OnDestroy {
  private readonly auditService = inject(AuditService);
  private auditSubscription?: Subscription;
  private tableLabelsSubscription?: Subscription;
  private readonly tablePresentation: Record<string, { displayName: string; initials: string }> = {
    'Holiday Calendar': {
      displayName: 'Holiday Calendar',
      initials: 'HC',
    },
    'Loco Singapore': {
      displayName: 'Singapore locomotives',
      initials: 'SG',
    },
    'Position Balance': {
      displayName: 'Position balances',
      initials: 'PB',
    },
  };

  response: AuditApiResponse | null = null;
  tableLabels: string[] = [];
  selectedTableLabel = '';
  tableSearchQuery = '';
  isLoading = true;
  areTableLabelsLoading = true;
  isTableMenuOpen = true;
  errorMessage = '';
  tableLabelsErrorMessage = '';

  get filteredTableLabels(): string[] {
    const searchTerm = this.tableSearchQuery.trim().toLocaleLowerCase();

    if (!searchTerm) {
      return this.tableLabels;
    }

    return this.tableLabels.filter((tableLabel) => {
      const displayName = this.getTableDisplayName(tableLabel);
      return `${tableLabel} ${displayName}`.toLocaleLowerCase().includes(searchTerm);
    });
  }

  ngOnInit(): void {
    this.loadAuditTableLabels();
    this.loadAuditRecords();
  }

  loadAuditTableLabels(): void {
    this.tableLabelsSubscription?.unsubscribe();
    this.areTableLabelsLoading = true;
    this.tableLabelsErrorMessage = '';

    this.tableLabelsSubscription = this.auditService.getAuditTableLabels().subscribe({
      next: (response) => {
        this.tableLabels = response.data.tableLabels;

        if (!this.selectedTableLabel && this.tableLabels.length > 0) {
          this.selectedTableLabel = this.tableLabels[0];
        }

        this.areTableLabelsLoading = false;
      },
      error: (error: unknown) => {
        console.error('Unable to load audit table labels.', error);
        this.tableLabels = [];
        this.tableLabelsErrorMessage = 'Unable to load audit tables.';
        this.areTableLabelsLoading = false;
      },
    });
  }

  loadAuditRecords(): void {
    this.auditSubscription?.unsubscribe();
    this.isLoading = true;
    this.errorMessage = '';

    this.auditSubscription = this.auditService.getAuditRecords().subscribe({
      next: (response) => {
        this.response = response;
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Unable to load audit records.', error);
        this.response = null;
        this.errorMessage = 'Unable to load audit records. Please try again.';
        this.isLoading = false;
      },
    });
  }

  refreshAuditPage(): void {
    this.isTableMenuOpen = true;
    this.loadAuditTableLabels();
    this.loadAuditRecords();
  }

  onTableSearch(event: Event): void {
    this.tableSearchQuery = (event.target as HTMLInputElement).value;
    this.isTableMenuOpen = true;
  }

  selectTable(tableLabel: string): void {
    this.selectedTableLabel = tableLabel;
    this.tableSearchQuery = '';
    this.isTableMenuOpen = false;
  }

  getTableDisplayName(tableLabel: string): string {
    return this.tablePresentation[tableLabel]?.displayName ?? tableLabel;
  }

  getTableInitials(tableLabel: string): string {
    const configuredInitials = this.tablePresentation[tableLabel]?.initials;

    if (configuredInitials) {
      return configuredInitials;
    }

    return tableLabel
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toLocaleUpperCase())
      .join('');
  }

  ngOnDestroy(): void {
    this.auditSubscription?.unsubscribe();
    this.tableLabelsSubscription?.unsubscribe();
  }
}
