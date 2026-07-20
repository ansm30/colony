import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
// 🌟 Notice we use 'getDocs' and 'startAfter' instead of 'collectionData'
import {
  Firestore,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter,
  DocumentData,
  QueryDocumentSnapshot
} from '@angular/fire/firestore';

export interface ActivityLog {
  id?: string;
  userEmail: string;
  action: string;
  details: string;
  timestamp: any;
}

@Component({
  selector: 'app-activity-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './activity-history.component.html',
  styleUrls: ['./activity-history.component.css']
})
export class ActivityHistoryComponent implements OnInit {
  private firestore = inject(Firestore);

  // Writable signals replace the stream listener
  logs = signal<ActivityLog[]>([]);
  isLoading = signal<boolean>(false);
  hasMore = signal<boolean>(true);

  // Remembers the last document read so Firebase knows where to resume
  private lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | null = null;
  private pageSize = 50;

  ngOnInit() {
    this.loadInitialLogs();
  }

  /**
   * Runs once on component mount - Fetches the top 50 logs
   */
  async loadInitialLogs() {
    this.isLoading.set(true);
    try {
      const logsRef = collection(this.firestore, 'activity-logs');
      const q = query(logsRef, orderBy('timestamp', 'desc'), limit(this.pageSize));

      const querySnapshot = await getDocs(q); // Normal one-time HTTP pull
      const fetchedLogs: ActivityLog[] = [];

      querySnapshot.forEach(doc => {
        fetchedLogs.push({ id: doc.id, ...doc.data() } as ActivityLog);
      });

      this.logs.set(fetchedLogs);

      // Save the final item as our pagination anchor point
      this.lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;

      // If we got less than 50 items, we hit the bottom of the table already
      if (querySnapshot.docs.length < this.pageSize) {
        this.hasMore.set(false);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Triggered manually by clicking the "Load More" action button
   */
  async loadMoreLogs() {
    if (!this.lastVisibleDoc || this.isLoading()) return;
    this.isLoading.set(true);

    try {
      const logsRef = collection(this.firestore, 'activity-logs');
      const q = query(
        logsRef,
        orderBy('timestamp', 'desc'),
        startAfter(this.lastVisibleDoc), // Start exactly where the last page stopped
        limit(this.pageSize)
      );

      const querySnapshot = await getDocs(q);
      const newLogs: ActivityLog[] = [];

      querySnapshot.forEach(doc => {
        newLogs.push({ id: doc.id, ...doc.data() } as ActivityLog);
      });

      if (newLogs.length > 0) {
        // Append new entries seamlessly onto your current array signal
        this.logs.update(current => [...current, ...newLogs]);
        this.lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;
      }

      // Check if this chunk is smaller than our batch limit
      if (querySnapshot.docs.length < this.pageSize) {
        this.hasMore.set(false);
      }
    } catch (error) {
      console.error('Error loading older logs:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  getShortName(email: string): string {
    if (!email) return 'System';
    return email.split('@')[0];
  }
}