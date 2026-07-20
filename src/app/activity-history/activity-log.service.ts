import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, serverTimestamp } from '@angular/fire/firestore';
import { AuthService } from '../../app/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class ActivityLogService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  /**
   * Automatically creates an audit trail entry in Firestore
   * @param action The type of transaction (e.g., 'CREATE_PAYMENT', 'UPDATE_PLOT')
   * @param details A descriptive string of exactly what changed
   */
  async log(action: string, details: string): Promise<void> {
    try {
      const currentUser = this.authService.currentUser();
      const logsCollection = collection(this.firestore, 'activity-logs');

      await addDoc(logsCollection, {
        userEmail: currentUser?.email || 'Anonymous/Public User',
        action: action,
        details: details,
        timestamp: serverTimestamp() // Uses Firebase server time, not local device time
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }
}