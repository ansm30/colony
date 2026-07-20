import { Injectable, inject } from '@angular/core';
import { Firestore, collection, onSnapshot, doc, updateDoc, query, where, writeBatch } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface PlotMonthConfig {
  status: 'Completed' | 'Empty' | 'Underconstruction';
  rate: number;
}

export interface Plot {
  id?: string;
  plotNumber: string;
  ownerName: string;
  phone: string;
  email: string;
  type: 'EWS' | 'LIG' | 'Others';
  status: 'Completed' | 'Empty' | 'Underconstruction';
  size: number;
  currentRate: number;
  outstandingDues: number; // Checked directly by the dashboard now
  history?: { [month: string]: PlotMonthConfig};
}

export interface Payment {
  id?: string;
  plotNumber: string;
  amount: number;
  month: string;
  date: string;
  method: string;
  remark?: string;
}

export interface Expense {
  id?: string;
  title: string;
  amount: number;
  month: string;
  date: string;
  remark?: string;
}

export interface FinancialSummary { totalCollected: number; totalSpent: number; }
export interface BillingMetadata { generatedMonths: string[]; }

@Injectable({ providedIn: 'root' })
export class ColonyService {
  private firestore = inject(Firestore);

  getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  getCurrentDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  getFinancialSummary(): Observable<FinancialSummary> {
    return new Observable<FinancialSummary>(subscriber => {
      const unsubscribe = onSnapshot(doc(this.firestore, 'metadata', 'financials'), (snap) => {
        if (snap.exists()) subscriber.next(snap.data() as FinancialSummary);
        else subscriber.next({ totalCollected: 0, totalSpent: 0 });
      }, (err) => subscriber.error(err));
      return () => unsubscribe();
    });
  }

  getBillingMetadata(): Observable<BillingMetadata> {
    return new Observable<BillingMetadata>(subscriber => {
      const unsubscribe = onSnapshot(doc(this.firestore, 'metadata', 'billing'), (snap) => {
        if (snap.exists()) subscriber.next(snap.data() as BillingMetadata);
        else subscriber.next({ generatedMonths: [] });
      }, (err) => subscriber.error(err));
      return () => unsubscribe();
    });
  }

  getPlots(): Observable<Plot[]> {
    return new Observable<Plot[]>(subscriber => {
      const unsubscribe = onSnapshot(collection(this.firestore, 'plots'), (snap) => {
        subscriber.next(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Plot[]);
      }, (err) => subscriber.error(err));
      return () => unsubscribe();
    });
  }

  getPaymentsByMonth(monthStr: string): Observable<Payment[]> {
    return new Observable<Payment[]>(subscriber => {
      const q = query(collection(this.firestore, 'payments'), where('month', '==', monthStr));
      const unsubscribe = onSnapshot(q, (snap) => {
        subscriber.next(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Payment[]);
      }, (err) => subscriber.error(err));
      return () => unsubscribe();
    });
  }

  getExpensesByMonth(monthStr: string): Observable<Expense[]> {
    return new Observable<Expense[]>(subscriber => {
      const q = query(collection(this.firestore, 'expenses'), where('month', '==', monthStr));
      const unsubscribe = onSnapshot(q, (snap) => {
        subscriber.next(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Expense[]);
      }, (err) => subscriber.error(err));
      return () => unsubscribe();
    });
  }

  getAllPayments(): Observable<Payment[]> {
    return new Observable<Payment[]>(subscriber => {
      const unsubscribe = onSnapshot(collection(this.firestore, 'payments'), (snap) => {
        subscriber.next(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Payment[]);
      }, (err) => subscriber.error(err));
      return () => unsubscribe();
    });
  }

  // Transaction engine: Adds payment ledger doc and securely decrements plot dues
  async addPaymentTransaction(payment: Payment, plotDocId: string, currentDues: number) {
    const batch = writeBatch(this.firestore);
    const newPaymentRef = doc(collection(this.firestore, 'payments'));

    batch.set(newPaymentRef, payment);

    const plotRef = doc(this.firestore, 'plots', plotDocId);
    const updatedDues = Math.max(0, currentDues - payment.amount);
    batch.update(plotRef, { outstandingDues: updatedDues });

    await batch.commit();
  }

  // Monthly lock transaction engine: Adds dues dynamically and seals the month log
  async generateMonthlyDuesBatch(
    monthStr: string,
    rates: { EWS: number; LIG: number; Empty: number; Others: number; },
    plotsList: Plot[],
    alreadyGenerated: string[]
  ) {
    const batch = writeBatch(this.firestore);

    plotsList.forEach(p => {
      if (!p.id) return;
      let billAmount = rates.Others;

      if (p.status === 'Empty') billAmount = rates.Empty;
      else if (p.type === 'EWS') billAmount = rates.EWS;
      else if (p.type === 'LIG') billAmount = rates.LIG;

      const plotRef = doc(this.firestore, 'plots', p.id);
      batch.update(plotRef, { outstandingDues: (p.outstandingDues || 0) + billAmount });
    });

    const billingRef = doc(this.firestore, 'metadata', 'billing');
    batch.set(billingRef, { generatedMonths: [...alreadyGenerated, monthStr] });

    await batch.commit();
  }

  // Used during plot registration initialization setup
  addPlot(plot: Plot) {
    const newPlotRef = doc(collection(this.firestore, 'plots'));
    const batch = writeBatch(this.firestore);
    batch.set(newPlotRef, plot);
    return batch.commit();
  }

  updatePlot(id: string, plot: Partial<Plot>) {
    return updateDoc(doc(this.firestore, 'plots', id), plot);
  }

  addExpense(expense: Expense) {
    const newExpenseRef = doc(collection(this.firestore, 'expenses'));
    const batch = writeBatch(this.firestore);
    batch.set(newExpenseRef, expense);
    return batch.commit();
  }

  updateBillingMetadata(months: string[]): Promise<void> {
    return updateDoc(doc(this.firestore, 'metadata', 'billing'), { generatedMonths: months });
  }
}