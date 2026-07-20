import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';

export const authGuard: CanActivateFn = async (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  // Ensures the guard waits until Firebase verifies the login token
  await auth.authStateReady();

  if (auth.currentUser) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};