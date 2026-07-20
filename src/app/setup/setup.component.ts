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

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatListModule],
  templateUrl: './setup.component.html'
})
export class SetupComponent implements OnInit {
  @Input() plots: Plot[] = [];
  private colonyService = inject(ColonyService);

  isEditing = signal(false);
  editingId: string | null = null;
  showSuccess = signal(false);

  selectedPlotNumber = signal<string | null>(null);
  allPaymentsList = signal<Payment[]>([]);

  historicalLogMonth = '';
  historicalLogRate = 500;

  form: Plot = { plotNumber: '', ownerName: '', phone: '', email: '', type: 'Others', status: 'Empty', size: 1000, currentRate: 800, history: {}, outstandingDues: 0 };

  ngOnInit() {
    this.colonyService.getAllPayments().subscribe(data => this.allPaymentsList.set(data));
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

    const operationalPromise = this.isEditing() && this.editingId
      ? this.colonyService.updatePlot(this.editingId, { ...this.form })
      : this.colonyService.addPlot({ ...this.form });

    operationalPromise.then(() => {
      this.showSuccess.set(true);
      this.cancel();
      setTimeout(() => this.showSuccess.set(false), 1500);
    });
  }
}