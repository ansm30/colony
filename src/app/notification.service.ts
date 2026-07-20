import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  message = signal<string | null>(null);
  isError = signal<boolean>(false);

  showSuccess(text: string) {
    this.message.set(text);
    this.isError.set(false);
    // Automatically hide after 3 seconds
    setTimeout(() => this.message.set(null), 3000);
  }

  showError(text: string) {
    this.message.set(text);
    this.isError.set(true);
    setTimeout(() => this.message.set(null), 4000);
  }
}