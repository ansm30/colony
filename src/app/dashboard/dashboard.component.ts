import { Component, Input, OnInit, computed, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ColonyService, Plot, Payment, Expense, FinancialSummary, BillingMetadata } from '../colony.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { NotificationService } from '../notification.service';
import { AuthService } from '../services/auth.service';

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
export class DashboardComponent implements OnInit, OnDestroy {

  colonyService = inject(ColonyService);
  public authService = inject(AuthService);

  currentMonth = this.colonyService.getCurrentMonth();
  search = signal<string>('');
  activeFilters = signal<string[]>([]);

  financialSummary = signal<FinancialSummary>({ totalCollected: 0, totalSpent: 0 });
  billingMetadata = signal<BillingMetadata>({ generatedMonths: [] });
  globalPayments = signal<Payment[]>([]);
  scopedPayments = signal<Payment[]>([]);
  scopedExpenses = signal<Expense[]>([]);

  private _plots = signal<Plot[]>([]);

  @Input() set plots(value: Plot[]) {
    this._plots.set(value || []);
  }
  get plots(): Plot[] {
    return this._plots();
  }

  // Category Dues Form Workspace Setup Panel
  rateEWS = 600;
  rateLIG = 600;
  rateEmpty = 500;
  rateOthers = 800;

  selectedPlotNumber = signal<string | null>(null);
  showTabularRegistry = signal<boolean>(false);
  private subs = new Subscription();
  private notify = inject(NotificationService);

  ngOnInit() {
    this.subs.add(this.colonyService.getFinancialSummary().subscribe(data => this.financialSummary.set(data)));
    this.subs.add(this.colonyService.getBillingMetadata().subscribe(data => this.billingMetadata.set(data)));
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

  // Checks if dues have already been initialized for the current month view
  isMonthBilled = computed(() => {
    return this.billingMetadata().generatedMonths.includes(this.currentMonth);
  });

  async triggerMonthlyBillingGeneration() {
    if (this.isMonthBilled()) return;

    const ratesPayload = {
      EWS: this.rateEWS,
      LIG: this.rateLIG,
      Empty: this.rateEmpty,
      Others: this.rateOthers
    };

    try {
      await this.colonyService.generateMonthlyDuesBatch(
        this.currentMonth,
        ratesPayload,
        this.plots,
        this.billingMetadata().generatedMonths
      );
      this.notify.showSuccess(`Cycle ${this.currentMonth} unlocked successfully!`);
    } catch (err) {
      console.error(err);
      this.notify.showError('Failed to post monthly dues. Check database permissions.');
    }
  }

  totalNetCashBalance = computed(() => {
    return this.financialSummary().totalCollected - this.financialSummary().totalSpent;
  });

  monthlyMetrics = computed(() => {
    let paid = this.scopedPayments().reduce((sum, item) => sum + item.amount, 0);
    let expenseValue = this.scopedExpenses().reduce((sum, item) => sum + item.amount, 0);
    let pending = this._plots().reduce((sum, p) => sum + (p.outstandingDues || 0), 0); // Changed to this._plots()

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
    let list = [...this._plots()]; // Changed to this._plots()
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
        return activeF.every(filterName => {
          if (filterName === 'Completed') return p.status === 'Completed';
          if (filterName === 'Empty') return p.status === 'Empty';
          if (filterName === 'Underconstruction') return p.status === 'Underconstruction';
          if (filterName === 'Dues') return (p.outstandingDues || 0) > 0;
          if (filterName === 'Pending') return (p.outstandingDues || 0) > 0;
          if (filterName === 'Paid') return (p.outstandingDues || 0) === 0;
          if (filterName === 'Partial') return totalPaidInMonth > 0 && (p.outstandingDues || 0) > 0;
          return true;
        });
      });
    }

    return list.map(p => {
      const totalPaidInMonth = this.scopedPayments().filter(pay => pay.plotNumber === p.plotNumber).reduce((sum, item) => sum + item.amount, 0);

      let currentMonthStatus = 'Pending';
      if ((p.outstandingDues || 0) === 0) currentMonthStatus = 'Fully Paid';
      else if (totalPaidInMonth > 0) currentMonthStatus = 'Partially Paid';

      return {
        plot: p,
        accumulatedPending: p.outstandingDues || 0, // Reads directly from Firestore tracking value
        currentMonthStatus
      };
    }).sort((a, b) => a.plot.plotNumber.localeCompare(b.plot.plotNumber, undefined, { numeric: true }));
  });

  tabularRegistryData = computed(() => {
    return this.plotBreakdown().map(item => {
      const p = item.plot;
      const plotPaymentsInMonth = this.scopedPayments().filter(pay => pay.plotNumber === p.plotNumber);
      const totalPaidInMonth = plotPaymentsInMonth.reduce((sum, pay) => sum + pay.amount, 0);

      const paymentDetailsSummary = plotPaymentsInMonth.length > 0
        ? plotPaymentsInMonth.map(pay => `${pay.date} (${pay.method || 'N/A'})`).join(', ')
        : '—';

      return {
        plotNumber: p.plotNumber,
        ownerName: p.ownerName,
        phone: p.phone || 'N/A',
        amountPaid: totalPaidInMonth,
        amountDue: p.outstandingDues || 0,
        size: p.size || 0,
        paymentDetails: paymentDetailsSummary,
        status: (p.outstandingDues || 0) === 0 ? 'PAID' : totalPaidInMonth > 0 ? 'PARTIAL' : 'DUE'
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