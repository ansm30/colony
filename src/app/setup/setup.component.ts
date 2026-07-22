import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ColonyService, Plot, Payment, Expense } from '../colony.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { NotificationService } from '../notification.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatListModule
  ],
  templateUrl: './setup.component.html'
})
export class SetupComponent implements OnInit {
  @Input() plots: Plot[] = [];
  private colonyService = inject(ColonyService);
  private notify = inject(NotificationService);

  isEditing = signal(false);
  editingId: string | null = null;
  showSuccess = signal(false);

  // Search & Category Filters
  searchQuery = '';
  filterStatus = 'ALL';
  filterType = 'ALL';

  selectedPlotNumber = signal<string | null>(null);
  allPaymentsList = signal<Payment[]>([]);
  generatedMonthsList = signal<string[]>([]);

  historicalLogMonth = '';
  historicalLogRate = 500;

  form: Plot = {
    plotNumber: '',
    ownerName: '',
    phone: '',
    email: '',
    type: 'Others',
    status: 'Empty',
    size: 1000,
    currentRate: 800,
    history: {},
    outstandingDues: 0
  };

  ngOnInit() {
    this.colonyService.getAllPayments().subscribe(data => this.allPaymentsList.set(data));

    this.colonyService.getBillingMetadata().subscribe(meta => {
      this.generatedMonthsList.set(meta?.generatedMonths || []);
    });
  }

  getFilteredPlots(): Plot[] {
    const query = this.searchQuery.toLowerCase().trim();
    return [...this.plots]
      .filter(p => {
        const matchesSearch = !query ||
          p.plotNumber.toLowerCase().includes(query) ||
          (p.ownerName && p.ownerName.toLowerCase().includes(query));

        const matchesStatus = this.filterStatus === 'ALL' || p.status === this.filterStatus;
        const matchesType = this.filterType === 'ALL' || p.type === this.filterType;

        return matchesSearch && matchesStatus && matchesType;
      })
      .sort((a, b) => a.plotNumber.localeCompare(b.plotNumber, undefined, { numeric: true }));
  }

  getSortedPlots(): Plot[] {
    return this.getFilteredPlots();
  }

  // Multi-Sheet Bulk Excel Importer (Fab-26 through July-2026 C with Master Plots Reconciliation)
  handleExcelWorkbookUpload(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      const plotMap = new Map<string, any>();
      const plotsTotalReceivedMap = new Map<string, number>();
      const monthlyPaymentsSumMap = new Map<string, number>();

      const extractedPayments: Payment[] = [];
      const extractedExpenses: Expense[] = [];

      const cleanPlotNo = (val: any) => String(val || '').trim();

      // STEP 1: PARSE 'PLOTS' MASTER SHEET
      if (workbook.Sheets['Plots']) {
        const rawPlots: any[] = XLSX.utils.sheet_to_json(workbook.Sheets['Plots'], { header: 1 });
        for (let i = 2; i < rawPlots.length; i++) {
          const row = rawPlots[i];
          if (!row || !row[2]) continue;

          const pno = cleanPlotNo(row[2]);
          if (!pno || ['plot no.', 'nan', 'total'].includes(pno.toLowerCase())) continue;

          let type = 'Others';
          let defaultRate = 800;
          if (pno.toUpperCase().includes('EWS')) { type = 'EWS'; defaultRate = 600; }
          else if (pno.toUpperCase().includes('LIG')) { type = 'LIG'; defaultRate = 600; }

          const dueVal = Number(row[3]);
          const totalReceivedVal = Number(row[4]);

          const owner = row[1] ? String(row[1]).trim() : '';
          const phone = row[5] ? String(row[5]).trim() : '';

          plotMap.set(pno, {
            plotNumber: pno,
            ownerName: owner,
            phone: phone,
            type: type,
            status: 'Empty',
            currentRate: defaultRate,
            outstandingDues: !isNaN(dueVal) && dueVal > 0 ? dueVal : defaultRate
          });

          if (!isNaN(totalReceivedVal) && totalReceivedVal > 0) {
            plotsTotalReceivedMap.set(pno, totalReceivedVal);
          }
        }
      }

      // STEP 2: PARSE MONTHLY SHEETS (Fab-26 through July-2026 C)
      const monthlySheets = [
        { name: 'Fab-26', monthCode: '2026-02' },
        { name: 'March-26', monthCode: '2026-03' },
        { name: 'April-26', monthCode: '2026-04' },
        { name: 'May - 2026 C', monthCode: '2026-05' },
        { name: 'June - 2026 C', monthCode: '2026-06' },
        { name: 'July - 2026 C', monthCode: '2026-07' }
      ];

      monthlySheets.forEach(m => {
        const sheet = workbook.Sheets[m.name];
        if (!sheet) return;

        const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        let isExpenseSection = false;

        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0) continue;

          const rowVals = [
            row[0] !== undefined ? row[0] : null,
            row[1] !== undefined ? row[1] : null,
            row[2] !== undefined ? row[2] : null,
            row[3] !== undefined ? row[3] : null,
            row[4] !== undefined ? row[4] : null,
            row[5] !== undefined ? row[5] : null,
            row[6] !== undefined ? row[6] : null
          ];

          const rowStr = rowVals.filter(v => v !== null).map(v => String(v)).join(' ').toLowerCase();

          // --- FAB-26 SPECIFIC PARSING ---
          if (m.name === 'Fab-26') {
            // Rows 1 to 34: Collections
            if (i >= 1 && i <= 34) {
              const pno = cleanPlotNo(rowVals[2]);
              const owner = rowVals[1] ? String(rowVals[1]).trim() : '';
              const amt = Number(rowVals[3]) || 0;

              if (pno && amt > 0) {
                extractedPayments.push({
                  plotNumber: pno,
                  amount: amt,
                  month: m.monthCode,
                  date: `${m.monthCode}-05`,
                  method: 'Cash/UPI',
                  remark: `Auto-imported from ${m.name}`
                });

                const currentSum = monthlyPaymentsSumMap.get(pno) || 0;
                monthlyPaymentsSumMap.set(pno, currentSum + amt);

                if (plotMap.has(pno)) {
                  const existing = plotMap.get(pno);
                  if (!existing.ownerName && owner) existing.ownerName = owner;
                }
              }
            }
            // Rows 39+: Expenses (Gardner ₹9,150, Electricity ₹7,000)
            else if (i >= 39) {
              const expTitle = rowVals[2] ? String(rowVals[2]).trim() : '';
              const paidVal = rowVals[4];
              if (expTitle && paidVal !== null && !['expenses', 'total', 'nan'].includes(expTitle.toLowerCase())) {
                const paidAmt = Number(paidVal) || 0;
                if (paidAmt > 0) {
                  extractedExpenses.push({
                    title: expTitle,
                    amount: paidAmt,
                    month: m.monthCode,
                    date: `${m.monthCode}-05`,
                    remark: `Auto-imported from ${m.name}`
                  });
                }
              }
            }
            continue;
          }

          // --- MARCH TO JULY PARSING ---
          // Detect Expense Section
          if (rowStr.includes('expenses') && (rowStr.includes('sn') || rowStr.includes('paid') || rowStr.includes('remark') || rowStr.includes('electricity'))) {
            isExpenseSection = true;
            continue;
          }

          if (isExpenseSection) {
            if (rowStr.includes('total') || rowStr.includes('remaining') || rowStr.includes('amount')) {
              isExpenseSection = false;
              continue;
            }

            const expTitle = rowVals[2] ? String(rowVals[2]).trim() : '';
            const paidVal = rowVals[4] !== null ? rowVals[4] : rowVals[3];
            const expRemark = rowVals[5] ? String(rowVals[5]).trim() : '';

            if (expTitle && !['expenses', 'sn', 'total', 'nan', 'plot no.'].includes(expTitle.toLowerCase())) {
              const paidAmt = Number(paidVal) || 0;
              if (paidAmt > 0) {
                extractedExpenses.push({
                  title: expTitle,
                  amount: paidAmt,
                  month: m.monthCode,
                  date: `${m.monthCode}-05`,
                  remark: expRemark || `Auto-imported from ${m.name}`
                });
              }
            }
          }

          // March & April Summary Expenses
          if (['March-26', 'April-26'].includes(m.name)) {
            if (rowStr.includes('expneces') || rowStr.includes('expences') || rowStr.includes('expenses')) {
              const amtVal = Number(rowVals[3]) || Number(rowVals[2]) || 0;
              if (amtVal > 10000) {
                extractedExpenses.push({
                  title: 'Monthly Expenses Summary',
                  amount: amtVal,
                  month: m.monthCode,
                  date: `${m.monthCode}-05`,
                  remark: `Auto-imported summary from ${m.name}`
                });
              }
            }
          }

          // Parse Plot Row
          const pno = cleanPlotNo(rowVals[2]);
          if (!pno || ['plot no.', 'plot', 'total', 'nan', 'balance'].includes(pno.toLowerCase())) continue;
          if (/gardner|electricity|sweeper|cctv|extra|note|expneces|expences|expenses/i.test(pno)) continue;

          const owner = rowVals[1] ? String(rowVals[1]).trim() : '';
          const amount = Number(rowVals[3]) || 0;
          const due = Number(rowVals[4]) || 0;
          let status = rowVals[5] ? String(rowVals[5]).trim() : 'Completed';
          if (status.toLowerCase() === 'under construction') status = 'Underconstruction';

          let defaultRate = 800;
          if (pno.toUpperCase().includes('EWS')) defaultRate = 600;
          else if (pno.toUpperCase().includes('LIG')) defaultRate = 600;

          if (!plotMap.has(pno)) {
            let type = 'Others';
            if (pno.toUpperCase().includes('EWS')) type = 'EWS';
            else if (pno.toUpperCase().includes('LIG')) type = 'LIG';

            plotMap.set(pno, {
              plotNumber: pno,
              ownerName: owner,
              phone: rowVals[6] ? String(rowVals[6]).trim() : '',
              type: type,
              status: status,
              currentRate: defaultRate,
              outstandingDues: due > 0 ? due : (amount === 0 ? defaultRate : 0)
            });
          } else {
            const existing = plotMap.get(pno);
            if (!existing.ownerName && owner) existing.ownerName = owner;
            if (status && status.toLowerCase() !== 'plot') existing.status = status;
            if (due > 0) existing.outstandingDues = due;
          }

          if (amount > 0) {
            extractedPayments.push({
              plotNumber: pno,
              amount: amount,
              month: m.monthCode,
              date: `${m.monthCode}-05`,
              method: 'Cash/UPI',
              remark: `Auto-imported from ${m.name}`
            });

            const currentSum = monthlyPaymentsSumMap.get(pno) || 0;
            monthlyPaymentsSumMap.set(pno, currentSum + amount);
          }
        }
      });

      // STEP 3: RECONCILE HISTORICAL / OPENING PAYMENTS STARTING FROM MARCH 2026
      plotsTotalReceivedMap.forEach((totalReceivedInMaster, pno) => {
        const sumFromMonthlySheets = monthlyPaymentsSumMap.get(pno) || 0;
        const diff = Math.max(0, totalReceivedInMaster - sumFromMonthlySheets);

        if (diff > 0) {
          // 👈 Changed to start strictly from March 2026 onwards (ignoring Feb)
          const cycleCodes = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
          let remainingDiff = diff;
          for (const c of cycleCodes) {
            if (remainingDiff <= 0) break;
            const chunk = Math.min(500, remainingDiff);
            extractedPayments.push({
              plotNumber: pno,
              amount: chunk,
              month: c,
              date: `${c}-01`,
              method: 'Master Record',
              remark: `Reconciled from Plots Master Sheet (Total: ₹${totalReceivedInMaster})`
            });
            remainingDiff -= chunk;
          }
        }
      });

      const allPlotsList = Array.from(plotMap.values());

      try {
        await this.colonyService.importWorkbookData(allPlotsList, extractedPayments, extractedExpenses);
        this.notify.showSuccess(`Imported ${allPlotsList.length} Plots, ${extractedPayments.length} Payments, and ${extractedExpenses.length} Expenses successfully!`);
      } catch (err) {
        console.error(err);
        this.notify.showError('Failed to import workbook data.');
      }
    };

    reader.readAsArrayBuffer(file);
  }

  startEdit(plot: Plot) {
    this.isEditing.set(true);
    this.editingId = plot.id || null;
    this.form = { ...plot, history: plot.history || {} };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  removeBilledMonth(monthStr: string) {
    if (confirm(`Unlock billing entries for cycle [${monthStr}]?`)) {
      const updatedArray = this.generatedMonthsList().filter(m => m !== monthStr);
      this.colonyService.updateBillingMetadata(updatedArray).then(() => {
        this.showSuccess.set(true);
        setTimeout(() => this.showSuccess.set(false), 1500);
      });
    }
  }

  setupPlotLedgerHistory = computed(() => {
    const targetNo = this.selectedPlotNumber();
    if (!targetNo) return [];
    return this.allPaymentsList()
      .filter(p => p.plotNumber === targetNo)
      .sort((a, b) => b.month.localeCompare(a.month));
  });

  openPlotLedger(plotNo: string) { this.selectedPlotNumber.set(plotNo); }
  closePlotLedger() { this.selectedPlotNumber.set(null); }

  appendHistoricalMonthOverride() {
    if (!this.historicalLogMonth) return;
    if (!this.form.history) this.form.history = {};
    this.form.history[this.historicalLogMonth] = { status: this.form.status, rate: this.historicalLogRate };
    this.historicalLogMonth = '';
  }

  cancel() {
    this.isEditing.set(false);
    this.editingId = null;
    this.form = {
      plotNumber: '',
      ownerName: '',
      phone: '',
      email: '',
      type: 'Others',
      status: 'Empty',
      size: 1000,
      currentRate: 800,
      history: {},
      outstandingDues: 0
    };
  }

  save() {
    if (!this.form.plotNumber || !this.form.ownerName) return;

    const plotPayload = {
      ...this.form,
      size: Number(this.form.size) || 0,
      outstandingDues: Number(this.form.outstandingDues) || 0
    };

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