import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <div class="login-wrapper">
      <mat-card>
        <h2 style="margin: 0; text-align: center; color: #3f51b5;">Colony Management ERP</h2>

        <!-- Added form tag to handle enter-key submissions natively -->
        <form (ngSubmit)="handleLogin()">

          <!-- Email Input Field -->
          <mat-form-field appearance="outline">
            <mat-label>Admin Email</mat-label>
            <input
              matInput
              type="email"
              name="email"
              [(ngModel)]="email"
              required
              placeholder="admin&#64;example.com">
          </mat-form-field>

          <!-- Password Input Field -->
          <mat-form-field appearance="outline">
            <mat-label>Password</mat-label>
            <input
              matInput
              type="password"
              name="password"
              [(ngModel)]="password"
              required
              placeholder="Enter your password">
          </mat-form-field>

          <!-- Error Message Display -->
          @if (errorMsg()) {
            <p class="error-banner">{{ errorMsg() }}</p>
          }

          <!-- Submit Button -->
          <button
            mat-raised-button
            color="primary"
            type="submit"
            [disabled]="loading() || !email || !password">
            {{ loading() ? 'Verifying...' : 'Sign In' }}
          </button>

        </form>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-wrapper { display: flex; justify-content: center; align-items: center; height: 100vh; background: #fafafa; }
    mat-card { width: 100%; max-width: 400px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    form { display: flex; flex-direction: column; gap: 16px; margin-top: 20px; }
    button { padding: 8px; font-size: 16px; margin-top: 8px; }
    .error-banner { color: #d32f2f; font-size: 14px; margin: 0; text-align: center; font-weight: 500; }
  `]
})
export class LoginComponent {
  private authService = inject(AuthService);

  email = '';
  password = '';
  loading = signal(false);
  errorMsg = signal('');

  async handleLogin() {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.errorMsg.set('');

    try {
      await this.authService.login(this.email, this.password);
    } catch (err: any) {
      this.errorMsg.set('Invalid credentials. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}