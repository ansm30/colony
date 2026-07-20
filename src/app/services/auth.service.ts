import { Injectable, inject, signal } from '@angular/core';
import { Auth, authState, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private router = inject(Router);

  // Expose the current user as a read-only signal for your UI tabs
  currentUser = signal<any>(null);
  authInitialized = signal(false);

  constructor() {
    // Watch auth changes quietly without forcing global redirects here
    authState(this.auth).subscribe(user => {
      this.currentUser.set(user);
      this.authInitialized.set(true);
    });
  }

  async login(email: string, password: string) {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    this.router.navigate(['/dashboard']); // Only redirect explicitly upon a SUCCESSFUL manual login click
    return credential;
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']); // Only redirect explicitly upon a manual logout click
  }
}