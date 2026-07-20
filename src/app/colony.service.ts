import { Injectable, inject } from '@angular/core';
import { Firestore, collection, onSnapshot, addDoc, doc, updateDoc, query, where } from '@angular/fire/firestore';
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
  outstandingDues: number; // High-performance tracking balance
  history?: { [month: string]: PlotMonthConfig };
}

export interface Payment {
  id?: string;
  plotNumber: string;
  amount: number;
  month: string; // e.g., '2026-07'
  date: string;  // e.g., '2026-07-20'
  method: 'UPI' | 'Cash' | 'Bank Transfer' | string; // 👈 Added
  remark?: string; // 👈 Added
}

export interface Expense {
  id?: string;
  title: string;
  amount: number;
  month: string;
  date: string;
  remark?: string; // 👈 Added
}

export interface FinancialSummary { totalCollected: number; totalSpent: number; }

@Injectable({ providedIn: 'root' })
export class ColonyService {
  private firestore = inject(Firestore);

  /**
   * Generates a local-timezone YYYY-MM string for HTML month inputs
   */
  getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Generates a local-timezone YYYY-MM-DD string for HTML date inputs
   */
  getCurrentDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // 1. High-Performance Cost-Free Summary Indicators
  getFinancialSummary(): Observable<FinancialSummary> {
    return new Observable<FinancialSummary>(subscriber => {
      const unsubscribe = onSnapshot(doc(this.firestore, 'metadata', 'financials'), (snap) => {
        if (snap.exists()) {
          subscriber.next(snap.data() as FinancialSummary);
        } else {
          subscriber.next({ totalCollected: 0, totalSpent: 0 });
        }
      }, (err) => subscriber.error(err));
      return () => unsubscribe();
    });
  }

  // 2. Structural Collections Sync
  getPlots(): Observable<Plot[]> {
    return new Observable<Plot[]>(subscriber => {
      const unsubscribe = onSnapshot(collection(this.firestore, 'plots'), (snap) => {
        subscriber.next(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Plot[]);
      }, (err) => subscriber.error(err));
      return () => unsubscribe();
    });
  }

  // 3. Lightweight Filtered Queries (Month-by-Month)
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

  // 4. Fallback Full Historical Syncs (Restored for Setup/Payment modules)
  getAllPayments(): Observable<Payment[]> {
    return new Observable<Payment[]>(subscriber => {
      const unsubscribe = onSnapshot(collection(this.firestore, 'payments'), (snap) => {
        subscriber.next(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Payment[]);
      }, (err) => subscriber.error(err));
      return () => unsubscribe();
    });
  }

  // 5. Rate Management Utilities
  getExpectedRateForMonth(plot: Plot, monthStr: string): number {
    if (plot.history && plot.history[monthStr]) return plot.history[monthStr].rate;
    if (plot.status === 'Empty') return 500;
    return plot.currentRate || 800;
  }

  getHistoricalMonths(targetMonthStr: string = '2026-07'): string[] {
    const months: string[] = [];
    let year = 2026;
    let month = 3;
    const [targetYear, targetMonth] = targetMonthStr.split('-').map(Number);

    while (year < targetYear || (year === targetYear && month <= targetMonth)) {
      months.push(`${year}-${month.toString().padStart(2, '0')}`);
      month++;
      if (month > 12) { month = 1; year++; }
    }
    return months;
  }

  // 6. Data Mutation Engines (Restored for Form Actions)
  addPlot(plot: Plot) { return addDoc(collection(this.firestore, 'plots'), plot); }
  updatePlot(id: string, plot: Partial<Plot>) { return updateDoc(doc(this.firestore, 'plots', id), plot); }
  addPayment(payment: Payment) { return addDoc(collection(this.firestore, 'payments'), payment); }
  addExpense(expense: Expense) { return addDoc(collection(this.firestore, 'expenses'), expense); }
}