import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';

export const routes: Routes = [
  // Anyone can hit the root or login paths without an AuthGuard blocking them
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: LoginComponent }, // Or whatever base component handles your view shell

  // Wildcard fallback
  { path: '**', redirectTo: 'dashboard' }
];