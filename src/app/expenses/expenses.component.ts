import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ColonyService, Expense } from '../colony.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { ActivityLogService } from '../activity-history/activity-log.service';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatListModule],
  templateUrl: './expenses.component.html'
})
export class ExpensesComponent {
  private colonyService = inject(ColonyService);
  private activityLog = inject(ActivityLogService);

  // Unified single configuration entity form
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
      remark: this.form.remark || undefined
    };

    this.colonyService.addExpense(expensePayload).then(async () => {
      this.showSuccess.set(true);
      await this.activityLog.log(
        'CREATE_EXPENSE',
        `Recorded expense of ${expensePayload.amount} for ${expensePayload.title} (${expensePayload.month})`
      );
      this.form = { title: '', amount: 0, month: this.colonyService.getCurrentMonth(), date: this.colonyService.getCurrentDate(), remark: '' };
      setTimeout(() => this.showSuccess.set(false), 2000);
    });
  }
}