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
import * as XLSX from 'xlsx';

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


handleExcelWorkbookUpload(event: any) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e: any) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });

    const plotMap = new Map<string, any>();
    const extractedPayments: any[] = [];

    // Helper to safely format plot numbers
    const cleanPlotNo = (val: any) => String(val || '').trim();

    // --- STEP 1: READ MASTER 'PLOTS' SHEET (106 Empty Plots) ---
    if (workbook.Sheets['Plots']) {
      const rawPlots: any[] = XLSX.utils.sheet_to_json(workbook.Sheets['Plots'], { header: 1 });
      for (let i = 1; i < rawPlots.length; i++) {
        const row = rawPlots[i];
        if (!row || !row[2]) continue;

        const pno = cleanPlotNo(row[2]);
        if (!pno || pno.toLowerCase() === 'plot no.' || pno.toLowerCase() === 'nan' || pno.toLowerCase() === 'total') continue;

        let type = 'Others';
        if (pno.toUpperCase().includes('EWS')) type = 'EWS';
        else if (pno.toUpperCase().includes('LIG')) type = 'LIG';

        plotMap.set(pno, {
          plotNumber: pno,
          ownerName: row[1] ? String(row[1]).trim() : '',
          phone: row[6] ? String(row[6]).trim() : '',
          type: type,
          status: 'Empty',
          outstandingDues: Number(row[4]) || 0
        });
      }
    }

    // --- STEP 2: SCAN ALL MONTHLY SHEETS (Constructed / Under Construction Plots) ---
    const monthlySheets = [
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
      let headerIdx = rawRows.findIndex(r => r && r.some((cell: any) => String(cell).toLowerCase().includes('plot')));
      if (headerIdx === -1) headerIdx = 0;

      for (let i = headerIdx + 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row) continue;

        const pno = cleanPlotNo(row[2]);
        if (!pno || pno.toLowerCase().includes('total') || pno.toLowerCase().includes('balance') || pno.toLowerCase().includes('expneces')) continue;

        // Skip non-plot expenses (like CCTV, Sweeper, etc.)
        if (/cctv|electricity|expense|extra|gardner|sweeper|wifi|boring|dawai|spray|repairing/i.test(pno)) continue;

        const owner = row[1] ? String(row[1]).trim() : '';
        const amount = Number(row[3]) || 0;
        const due = Number(row[4]) || 0;
        let status = row[5] ? String(row[5]).trim() : 'Completed';
        if (status.toLowerCase() === 'under construction') status = 'Underconstruction';

        // If this plot wasn't in 'Plots' tab, add its plot profile now!
        if (!plotMap.has(pno)) {
          let type = 'Others';
          if (pno.toUpperCase().includes('EWS')) type = 'EWS';
          else if (pno.toUpperCase().includes('LIG')) type = 'LIG';

          plotMap.set(pno, {
            plotNumber: pno,
            ownerName: owner,
            phone: row[6] ? String(row[6]).trim() : '',
            type: type,
            status: status,
            outstandingDues: due
          });
        } else {
          // If plot exists, update owner/status if missing
          const existing = plotMap.get(pno);
          if (!existing.ownerName && owner) existing.ownerName = owner;
          if (status && status !== 'Plot') existing.status = status;
        }

        // Collect payment if amount > 0
        if (amount > 0) {
          extractedPayments.push({
            plotNumber: pno,
            amount: amount,
            month: m.monthCode,
            date: `${m.monthCode}-05`,
            method: 'Cash/UPI',
            remark: `Auto-imported from ${m.name}`
          });
        }
      }
    });

    const allPlotsList = Array.from(plotMap.values());

    try {
      await this.colonyService.importWorkbookData(allPlotsList, extractedPayments);
      this.notify.showSuccess(`Success! Imported ALL ${allPlotsList.length} Plots and ${extractedPayments.length} Payments.`);
    } catch (err) {
      console.error(err);
      this.notify.showError('Failed to import workbook data.');
    }
  };

  reader.readAsArrayBuffer(file);
}
}