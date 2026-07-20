import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ColonyService, Plot, Payment } from '../colony.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { NotificationService } from '../notification.service';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatListModule],
  templateUrl: './setup.component.html'
})
export class SetupComponent implements OnInit {
  @Input() plots: Plot[] = [];
  private colonyService = inject(ColonyService);
  private notify = inject(NotificationService);

  isEditing = signal(false);
  editingId: string | null = null;
  showSuccess = signal(false);

  selectedPlotNumber = signal<string | null>(null);
  allPaymentsList = signal<Payment[]>([]);
  generatedMonthsList = signal<string[]>([]);

  historicalLogMonth = '';
  historicalLogRate = 500;

  form: Plot = { plotNumber: '', ownerName: '', phone: '', email: '', type: 'Others', status: 'Empty', size: 1000, currentRate: 800, history: {}, outstandingDues: 0 };

 ngOnInit() {
  this.colonyService.getAllPayments().subscribe(data => this.allPaymentsList.set(data));

  // Connect directly to the database billing lock arrays
  this.colonyService.getBillingMetadata().subscribe(meta => {
    this.generatedMonthsList.set(meta?.generatedMonths || []);
  });
}

removeBilledMonth(monthStr: string) {
  if (confirm(`Unlock billing entries for cycle [${monthStr}]? This reactivates the dashboard button.`)) {
    const updatedArray = this.generatedMonthsList().filter(m => m !== monthStr);

    this.colonyService.updateBillingMetadata(updatedArray).then(() => {
      this.showSuccess.set(true);
      setTimeout(() => this.showSuccess.set(false), 1500);
    });
  }
}

  getSortedPlots() {
    return [...this.plots].sort((a, b) => a.plotNumber.localeCompare(b.plotNumber, undefined, { numeric: true }));
  }

  setupPlotLedgerHistory = computed(() => {
    const targetNo = this.selectedPlotNumber();
    if (!targetNo) return [];
    return this.allPaymentsList()
      .filter(p => p.plotNumber === targetNo)
      .sort((a, b) => b.month.localeCompare(a.month));
  });

  openPlotLedger(plotNo: string) {
    this.selectedPlotNumber.set(plotNo);
  }

  closePlotLedger() {
    this.selectedPlotNumber.set(null);
  }

  startEdit(plot: Plot) {
    this.isEditing.set(true);
    this.editingId = plot.id || null;
    this.form = { ...plot, history: plot.history || {} };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  appendHistoricalMonthOverride() {
    if (!this.historicalLogMonth) return;
    if (!this.form.history) this.form.history = {};
    this.form.history[this.historicalLogMonth] = { status: this.form.status, rate: this.historicalLogRate };
    this.historicalLogMonth = '';
  }

  cancel() {
    this.isEditing.set(false);
    this.editingId = null;
    this.form = { plotNumber: '', ownerName: '', phone: '', email: '', type: 'Others', status: 'Empty', size: 1000, currentRate: 800, history: {}, outstandingDues: 0 };
  }

  save() {
    if (!this.form.plotNumber || !this.form.ownerName) return;

    // 1. Prepare and clean the payload to ensure numbers are strictly types as numbers
    const plotPayload = {
      ...this.form,
      size: Number(this.form.size) || 0,
      // Safely defaults to 0 if empty, otherwise captures the opening balance entered by the admin
      outstandingDues: Number(this.form.outstandingDues) || 0
    };

    // 2. Decide whether we are updating a current record or setting up a brand new plot
    const operationalPromise = this.isEditing() && this.editingId
      ? this.colonyService.updatePlot(this.editingId, plotPayload)
      : this.colonyService.addPlot(plotPayload);

    operationalPromise.then(() => {
      this.showSuccess.set(true);
      this.cancel();
      setTimeout(() => this.showSuccess.set(false), 1500);
    }).catch((err) => {
      console.error('Failed to save plot record:', err);
      this.notify.showError('Failed to save plot record.');
    });
  }
}