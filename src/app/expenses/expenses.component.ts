import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ColonyService, Expense } from '../colony.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatListModule],
  templateUrl: './expenses.component.html'
})
export class ExpensesComponent {
  private colonyService = inject(ColonyService);

  form = { title: '', amount: 0, month: '2026-07' };
  filterMonth = signal<string>('2026-07');
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
    this.colonyService.addExpense({ ...this.form, date: new Date().toLocaleDateString() }).then(() => {
      this.showSuccess.set(true);
      this.form = { title: '', amount: 0, month: '2026-07' };
      setTimeout(() => this.showSuccess.set(false), 2000); // Auto-clear overlay panel
    });
  }
}