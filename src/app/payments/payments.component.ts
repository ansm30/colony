import { Component, Input, OnInit, inject, signal, effect } from '@angular/core';
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
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatListModule],
  templateUrl: './payments.component.html'
})
export class PaymentsComponent implements OnInit {
  @Input() plots: Plot[] = [];
  private colonyService = inject(ColonyService);
  private notify = inject(NotificationService);

  form = {
    plotNumber: '',
    amount: 0,
    month: this.colonyService.getCurrentMonth(),
    date: this.colonyService.getCurrentDate(),
    method: 'UPI',
    remark: ''
  };

  filterPlot = '';
  filterMonth = signal<string>('2026-07');
  scopedPayments = signal<Payment[]>([]);

  showSuccess = signal(false);
  lastSavedPayment = signal<Payment | null>(null);

  constructor() {
    effect(() => {
      this.colonyService.getPaymentsByMonth(this.filterMonth()).subscribe(data => {
        this.scopedPayments.set(data);
      });
    });
  }

  ngOnInit() {}

  getSortedPlotsInput() {
    return [...this.plots].sort((a, b) => a.plotNumber.localeCompare(b.plotNumber, undefined, { numeric: true }));
  }

  getFilteredPayments() {
    return this.scopedPayments()
      .filter(p => !this.filterPlot || p.plotNumber.toLowerCase().includes(this.filterPlot.toLowerCase().trim()))
      .sort((a, b) => a.plotNumber.localeCompare(b.plotNumber, undefined, { numeric: true }));
  }

  changeMonthFilter(event: any) {
    this.filterMonth.set(event.target.value);
  }

  autoFillRate() {
    const found = this.plots.find(p => p.plotNumber === this.form.plotNumber);
    if (found) {
      this.form.amount = found.outstandingDues || 0;
    }
  }

  // Inside your payments.component.ts save processing interceptor:
  save() {
    if (!this.form.plotNumber || !this.form.amount) return;

    // 1. Locate the live reference object from the database array
    const matchedPlot = this.plots.find(p => p.plotNumber === this.form.plotNumber);
    if (!matchedPlot || !matchedPlot.id) {
      this.notify.showError('Error: Plot reference sequence not found in configuration list.');
      return;
    }

    const paymentPayload: Payment = {
      plotNumber: this.form.plotNumber,
      amount: this.form.amount,
      month: this.form.month,
      date: this.form.date,
      method: this.form.method,
      remark: this.form.remark || undefined
    };

    // 2. Fire atomic operation passing database ID and running dues balance
    this.colonyService.addPaymentTransaction(
      paymentPayload,
      matchedPlot.id,
      matchedPlot.outstandingDues || 0
    ).then(() => {
      this.notify.showSuccess('Payment synchronized and outstanding balance reduced successfully.');
    });
  }
  whatsappMeReceipt() {
    if (!this.lastSavedPayment()) return;
    const p = this.lastSavedPayment();
    if (!p) return;

    const targetPlotProfile = this.plots.find(plot => plot.plotNumber === p.plotNumber);
    let targetPhone = targetPlotProfile?.phone ? targetPlotProfile.phone.replace(/[^0-9]/g, '') : '';

    if (targetPhone.length === 10) {
      targetPhone = '91' + targetPhone;
    }

    const msg = `*Payment Confirmation Receipt*\n\n✅ Plot Reference: *Plot #${p.plotNumber}*\n💰 Amount Collected: *₹${p.amount}*\n📅 Statement Cycle: *${p.month}*\n🏛 Date Logged: *${p.date}*\n\nThank you!`;
    window.open(`https://wa.me/${targetPhone || '910000000000'}?text=${encodeURIComponent(msg)}`, '_blank');
    this.closeOverlay();
  }

  closeOverlay() {
    this.showSuccess.set(false);
  }
}