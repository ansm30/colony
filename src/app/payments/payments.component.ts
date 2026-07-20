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

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatListModule],
  templateUrl: './payments.component.html'
})
export class PaymentsComponent implements OnInit {
  @Input() plots: Plot[] = [];
  private colonyService = inject(ColonyService);

  form = { plotNumber: '', amount: 0, month: '2026-07' };
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
      this.form.amount = this.colonyService.getExpectedRateForMonth(found, this.form.month);
    }
  }

  save() {
    if (!this.form.plotNumber || !this.form.amount) return;
    const paymentPayload: Payment = { ...this.form, date: new Date().toLocaleDateString() };

    this.colonyService.addPayment(paymentPayload).then(() => {
      this.lastSavedPayment.set(paymentPayload);
      this.showSuccess.set(true);
      this.form = { plotNumber: '', amount: 0, month: '2026-07' };
    });
  }

whatsappMeReceipt() {
    if (!this.lastSavedPayment()) return;
    const p = this.lastSavedPayment()!;

    // DYNAMIC ENTRY LOOKUP: Find the real mobile configuration details saved inside the plot profiles array
    const targetPlotProfile = this.plots.find(plot => plot.plotNumber === p.plotNumber);

    // Fallback to standard admin string if phone entry is missing or unconfigured
    let targetPhone = targetPlotProfile?.phone ? targetPlotProfile.phone.replace(/[^0-9]/g, '') : '';

    // Prepend India standard country prefix code sequence if missing from string data
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