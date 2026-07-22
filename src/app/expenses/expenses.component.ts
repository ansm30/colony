import { Component, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ColonyService, Expense } from '../colony.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { NotificationService } from '../notification.service';
import { ActivityLogService } from '../activity-history/activity-log.service';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatListModule],
  templateUrl: './expenses.component.html'
})
export class ExpensesComponent {
  private colonyService = inject(ColonyService);
  private notify = inject(NotificationService);
  private activityLog = inject(ActivityLogService);

  form = {
    title: '',
    amount: 0,
    month: this.colonyService.getCurrentMonth(),
    date: this.colonyService.getCurrentDate(),
    remark: ''
  };

  filterMonth = signal<string>(this.colonyService.getCurrentMonth());
  scopedExpenses = signal<Expense[]>([]);
  showSuccess = signal(false);

  constructor() {
    effect(() => {
      this.colonyService.getExpensesByMonth(this.filterMonth()).subscribe(data => {
        this.scopedExpenses.set(data);
      });
    });
  }

  changeMonthFilter(event: any) {
    this.filterMonth.set(event.target.value);
  }

  save() {
    if (!this.form.title || !this.form.amount) return;

    const expensePayload: Expense = {
      title: this.form.title,
      amount: this.form.amount,
      month: this.form.month,
      date: this.form.date,
      remark: this.form.remark ? this.form.remark.trim() : '' // 👈 Changed from 'undefined' to ''
    };

    this.colonyService.addExpense(expensePayload).then(async () => {
      this.showSuccess.set(true);
      await this.activityLog.log(
        'CREATE_EXPENSE',
        `Recorded expense of ₹${expensePayload.amount} for ${expensePayload.title} (${expensePayload.month})`
      );
      this.notify.showSuccess('Expense voucher saved successfully.');
      this.form = { title: '', amount: 0, month: this.colonyService.getCurrentMonth(), date: this.colonyService.getCurrentDate(), remark: '' };
      setTimeout(() => this.showSuccess.set(false), 2000);
    }).catch(err => {
      console.error(err);
      this.notify.showError('Failed to record expense.');
    });
  }

  // Live computed total of all expenses for the selected month
  totalMonthExpense = computed(() => {
    return this.scopedExpenses().reduce((sum, e) => sum + (e.amount || 0), 0);
  });

  async onDeleteExpense(expense: Expense) {
    if (!expense.id) return;

    const confirmMsg = `Delete expense record "${expense.title}" of ₹${expense.amount}?`;

    if (confirm(confirmMsg)) {
      try {
        await this.colonyService.deleteExpense(expense.id);
        await this.activityLog.log('DELETE_EXPENSE', `Deleted expense "${expense.title}" of ₹${expense.amount}`);
        this.notify.showSuccess('Expense record deleted successfully.');
      } catch (err) {
        console.error(err);
        this.notify.showError('Failed to delete expense record.');
      }
    }
  }
}