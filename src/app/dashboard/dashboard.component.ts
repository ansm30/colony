import { Component, Input, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ColonyService, Plot, Payment, Expense, FinancialSummary } from '../colony.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatListModule, MatTabsModule, MatIconModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  @Input() plots: Plot[] = [];
  colonyService = inject(ColonyService);

  currentMonth = this.colonyService.getCurrentMonth();
  search = signal<string>('');
  activeFilters = signal<string[]>([]);

  financialSummary = signal<FinancialSummary>({ totalCollected: 0, totalSpent: 0 });
  globalPayments = signal<Payment[]>([]);
  scopedPayments = signal<Payment[]>([]);
  scopedExpenses = signal<Expense[]>([]);

  selectedPlotNumber = signal<string | null>(null);
  showTabularRegistry = signal<boolean>(false);

  private subs = new Subscription();

  ngOnInit() {
    this.subs.add(this.colonyService.getFinancialSummary().subscribe(data => this.financialSummary.set(data)));
    this.subs.add(this.colonyService.getAllPayments().subscribe(data => this.globalPayments.set(data)));
    this.syncSelectedMonthData();
  }

  onMonthChange() {
    this.syncSelectedMonthData();
  }

  syncSelectedMonthData() {
    if (!this.currentMonth) return;
    this.subs.add(this.colonyService.getPaymentsByMonth(this.currentMonth).subscribe(data => {
      this.scopedPayments.set(data.sort((a, b) => a.plotNumber.localeCompare(b.plotNumber, undefined, { numeric: true })));
    }));
    this.subs.add(this.colonyService.getExpensesByMonth(this.currentMonth).subscribe(data => {
      this.scopedExpenses.set(data);
    }));
  }

  totalNetCashBalance = computed(() => {
    return this.financialSummary().totalCollected - this.financialSummary().totalSpent;
  });

  monthlyMetrics = computed(() => {
    let paid = this.scopedPayments().reduce((sum, item) => sum + item.amount, 0);
    let expenseValue = this.scopedExpenses().reduce((sum, item) => sum + item.amount, 0);

    let pending = 0;
    this.plots.forEach(p => {
      const collected = this.scopedPayments().filter(pay => pay.plotNumber === p.plotNumber).reduce((sum, item) => sum + item.amount, 0);
      const expected = this.colonyService.getExpectedRateForMonth(p, this.currentMonth);
      if (collected < expected) pending += (expected - collected);
    });

    return { paid, expense: expenseValue, pending };
  });

  toggleFilter(filter: string) {
    const current = this.activeFilters();
    if (current.includes(filter)) {
      this.activeFilters.set(current.filter(f => f !== filter));
    } else {
      this.activeFilters.set([...current, filter]);
    }
  }

  plotBreakdown = computed(() => {
    let list = [...this.plots];
    const queryStr = this.search().toLowerCase().trim();
    const activeF = this.activeFilters();

    if (queryStr) {
      list = list.filter(p =>
        p.plotNumber.toLowerCase().includes(queryStr) ||
        p.ownerName.toLowerCase().includes(queryStr)
      );
    }

    if (activeF.length > 0) {
      list = list.filter(p => {
        const totalPaidInMonth = this.scopedPayments().filter(pay => pay.plotNumber === p.plotNumber).reduce((sum, item) => sum + item.amount, 0);
        const expected = this.colonyService.getExpectedRateForMonth(p, this.currentMonth);
        const isFullyPaid = totalPaidInMonth >= expected;

        return activeF.every(filterName => {
          if (filterName === 'Completed') return p.status === 'Completed';
          if (filterName === 'Empty') return p.status === 'Empty';
          if (filterName === 'Underconstruction') return p.status === 'Underconstruction';
          if (filterName === 'Dues') return (p.outstandingDues || 0) > 0;
          if (filterName === 'Pending') return !isFullyPaid;
          if (filterName === 'Paid') return isFullyPaid;
          if (filterName === 'Partial') return totalPaidInMonth > 0 && !isFullyPaid;
          return true;
        });
      });
    }

    return list.map(p => {
      const totalPaidInMonth = this.scopedPayments().filter(pay => pay.plotNumber === p.plotNumber).reduce((sum, item) => sum + item.amount, 0);
      const expected = this.colonyService.getExpectedRateForMonth(p, this.currentMonth);

      let currentMonthStatus = 'Pending';
      if (totalPaidInMonth >= expected) currentMonthStatus = 'Fully Paid';
      else if (totalPaidInMonth > 0) currentMonthStatus = 'Partially Paid';

      return {
        plot: p,
        accumulatedPending: p.outstandingDues || 0,
        currentMonthStatus
      };
    }).sort((a, b) => a.plot.plotNumber.localeCompare(b.plot.plotNumber, undefined, { numeric: true }));
  });

  tabularRegistryData = computed(() => {
    return this.plotBreakdown().map(item => {
      const p = item.plot;

      // Filter out all payments matching this specific plot for the viewed month
      const plotPaymentsInMonth = this.scopedPayments().filter(pay => pay.plotNumber === p.plotNumber);
      const totalPaidInMonth = plotPaymentsInMonth.reduce((sum, pay) => sum + pay.amount, 0);

      const expected = this.colonyService.getExpectedRateForMonth(p, this.currentMonth);
      const currentDueAmount = Math.max(0, expected - totalPaidInMonth);

      // NEW: Extract dates and payment methods into a readable summary string
      const paymentDetailsSummary = plotPaymentsInMonth.length > 0
        ? plotPaymentsInMonth.map(pay => `${pay.date} (${pay.method || 'N/A'})`).join(', ')
        : '—';

      return {
        plotNumber: p.plotNumber,
        ownerName: p.ownerName,
        phone: p.phone || 'N/A',
        amountPaid: totalPaidInMonth,
        amountDue: currentDueAmount,
        size: p.size || 0,
        paymentDetails: paymentDetailsSummary, // 👈 Exposed to view template
        status: totalPaidInMonth >= expected ? 'PAID' : totalPaidInMonth > 0 ? 'PARTIAL' : 'DUE'
      };
    });
  });

  totalHistoricalPending = computed(() => {
    return this.plotBreakdown().reduce((sum, item) => sum + item.accumulatedPending, 0);
  });

  targetPlotLedgerHistory = computed(() => {
    const activePlotNo = this.selectedPlotNumber();
    if (!activePlotNo) return [];
    return this.globalPayments()
      .filter(p => p.plotNumber === activePlotNo)
      .sort((a, b) => b.month.localeCompare(a.month));
  });

  openPlotLedger(plotNo: string) { this.selectedPlotNumber.set(plotNo); }
  closePlotLedger() { this.selectedPlotNumber.set(null); }
  toggleTabularRegistry(state: boolean) { this.showTabularRegistry.set(state); }

  shareTabularRegistryViaWhatsApp() {
    let text = `*📊 CORAL LIFE COLONY LEDGER: ${this.currentMonth}*\n`;
    text += `------------------------------------------\n`;
    text += `*Plot* | *Owner* | *Paid* | *Due*\n`;
    text += `------------------------------------------\n`;
    this.tabularRegistryData().forEach(row => {
      const statusIcon = row.status === 'PAID' ? '✅' : row.status === 'PARTIAL' ? '⏳' : '❌';
      text += `• *#${row.plotNumber}* | ${row.ownerName} | Paid: ₹${row.amountPaid} | Due: ₹${row.amountDue} ${statusIcon}\n`;
    });
    text += `------------------------------------------\n`;
    text += `📈 MTD Collection: ₹${this.monthlyMetrics().paid}\n`;
    text += `📉 MTD Expenses: ₹${this.monthlyMetrics().expense}\n`;
    text += `💰 Available Cash Balance: ₹${this.totalNetCashBalance()}\n`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  shareStatementViaWhatsApp() {
    let text = `*Coral Life Colony Outstanding Statement - ${this.currentMonth}*\n\n`;
    this.plotBreakdown().forEach(item => {
      text += `• *Plot ${item.plot.plotNumber}* (${item.plot.ownerName}): Outstanding: *₹${item.accumulatedPending}*\n`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }
}