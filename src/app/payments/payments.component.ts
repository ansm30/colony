import { Component, Input, OnInit, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ColonyService, Plot, Payment } from '../colony.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { NotificationService } from '../notification.service';
import { ActivityLogService } from '../activity-history/activity-log.service';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatListModule
  ],
  templateUrl: './payments.component.html'
})
export class PaymentsComponent implements OnInit {
  @Input() plots: Plot[] = [];
  private colonyService = inject(ColonyService);
  private notify = inject(NotificationService);
  private activityLog = inject(ActivityLogService);

  form = {
    plotNumber: '',
    amount: 0,
    month: this.colonyService.getCurrentMonth(),
    date: this.colonyService.getCurrentDate(),
    method: 'UPI',
    remark: ''
  };

  filterPlot = '';
  filterMonth = signal<string>(this.colonyService.getCurrentMonth());
  scopedPayments = signal<Payment[]>([]);

  showSuccess = signal(false);
  lastSavedPayment = signal<Payment | null>(null);

  // Toggles
  isCompactView = signal<boolean>(false);
  isTableView = signal<boolean>(false);

  constructor() {
    effect(() => {
      this.colonyService.getPaymentsByMonth(this.filterMonth()).subscribe(data => {
        this.scopedPayments.set(data);
      });
    });
  }

  ngOnInit() { }

  getFilteredPlotsForInput(): Plot[] {
    const query = this.form.plotNumber ? this.form.plotNumber.toLowerCase().trim() : '';
    return (this.plots || [])
      .filter(p =>
        p.plotNumber.toLowerCase().includes(query) ||
        (p.ownerName && p.ownerName.toLowerCase().includes(query))
      )
      .sort((a, b) => a.plotNumber.localeCompare(b.plotNumber, undefined, { numeric: true }));
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

  totalMonthCollection = computed(() => {
    return this.getFilteredPayments().reduce((sum, p) => sum + (p.amount || 0), 0);
  });

  toggleCompactView() {
    this.isCompactView.update(v => !v);
  }

  toggleTableView() {
    this.isTableView.update(v => !v);
  }

  save() {
    if (!this.form.plotNumber || !this.form.amount) return;

    const matchedPlot = this.plots.find(p => p.plotNumber === this.form.plotNumber);
    if (!matchedPlot || !matchedPlot.id) {
      this.notify.showError('Error: Selected plot was not found in plot configuration list.');
      return;
    }

    const paymentPayload: Payment = {
      plotNumber: this.form.plotNumber,
      amount: this.form.amount,
      month: this.form.month,
      date: this.form.date,
      method: this.form.method,
      remark: this.form.remark ? this.form.remark.trim() : ''
    };

    this.colonyService.addPaymentTransaction(
      paymentPayload,
      matchedPlot.id,
      matchedPlot.outstandingDues || 0
    ).then(async () => {
      try {
        await this.activityLog.log(
          'CREATE_PAYMENT',
          `Processed payment of ₹${paymentPayload.amount} for Plot #${paymentPayload.plotNumber} (${paymentPayload.month}) via ${paymentPayload.method}`
        );
      } catch (logError) {
        console.warn('Activity log background write error:', logError);
      }

      this.lastSavedPayment.set(paymentPayload);
      this.showSuccess.set(true);
      this.notify.showSuccess('Payment logged and plot outstanding balance updated.');

      this.form = {
        plotNumber: '',
        amount: 0,
        month: this.colonyService.getCurrentMonth(),
        date: this.colonyService.getCurrentDate(),
        method: 'UPI',
        remark: ''
      };
    }).catch((dbError) => {
      this.notify.showError('Database Error: Could not save payment.');
      console.error(dbError);
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

  async onDeletePayment(payment: Payment) {
    if (!payment.id) return;

    const confirmMsg = `Revert payment of ₹${payment.amount} for Plot #${payment.plotNumber}? This will add ₹${payment.amount} back to the plot dues.`;

    if (confirm(confirmMsg)) {
      try {
        await this.colonyService.deletePayment(payment.id, payment.plotNumber, payment.amount);
        await this.activityLog.log('DELETE_PAYMENT', `Reverted payment of ₹${payment.amount} for Plot #${payment.plotNumber}`);
        this.notify.showSuccess(`Payment reverted for Plot #${payment.plotNumber}. Dues restored.`);
      } catch (err) {
        console.error(err);
        this.notify.showError('Failed to revert payment.');
      }
    }
  }
}