import { Injectable, inject, signal } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, user } from '@angular/fire/auth';
import type { User } from 'firebase/auth';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private router = inject(Router);

  // Reactive signal readable by any component
  currentUser = signal<User | null>(null);

  constructor() {
    // Keeps your app state perfectly in sync with Firebase
    user(this.auth).subscribe(userState => {
      this.currentUser.set(userState);
    });
  }

  async login(email: string, password: string) {
    await signInWithEmailAndPassword(this.auth, email, password);
    this.router.navigate(['/dashboard']);
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }
}