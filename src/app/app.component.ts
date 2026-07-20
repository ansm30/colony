import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ColonyService } from './colony.service';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';

import { DashboardComponent } from './dashboard/dashboard.component';
import { PaymentsComponent } from './payments/payments.component';
import { ExpensesComponent } from './expenses/expenses.component';
import { SetupComponent } from './setup/setup.component';
import { NotificationService } from './notification.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, MatToolbarModule, MatButtonModule,
    DashboardComponent, PaymentsComponent, ExpensesComponent, SetupComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private colonyService = inject(ColonyService);
  public notificationService = inject(NotificationService)
  activeTab = signal<'dashboard' | 'payment' | 'expense' | 'setup'>('dashboard');
  allPlots = signal<any[]>([]);

  ngOnInit() {
    this.colonyService.getPlots().subscribe(data => this.allPlots.set(data));
  }
}