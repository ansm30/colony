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
import { RouterOutlet, Router } from '@angular/router'; // <-- Added Router here
import { AuthService } from './services/auth.service';
import { ActivityHistoryComponent } from './activity-history/activity-history.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, MatToolbarModule, MatButtonModule, RouterOutlet,
    DashboardComponent, PaymentsComponent, ExpensesComponent, SetupComponent, ActivityHistoryComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})

export class AppComponent implements OnInit {
  private colonyService = inject(ColonyService);
  public notificationService = inject(NotificationService);
  public authService = inject(AuthService);
  public router = inject(Router);

  activeTab = signal<'dashboard' | 'payment' | 'expense' | 'setup' | 'history'>('dashboard');
  allPlots = signal<any[]>([]);

  ngOnInit() {
    this.colonyService.getPlots().subscribe(data => this.allPlots.set(data));
  }

  logout() {
    this.authService.logout().then(() => {
      this.router.navigate(['/login']);
    });
  }
}