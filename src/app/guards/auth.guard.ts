import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { map, take } from 'rxjs/operators';

export const authGuard = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  // authState watches the Firebase connection status
  return authState(auth).pipe(
    take(1), // Take the very first resolved status emission and complete
    map(user => {
      if (user) {
        return true; // User session restored! Allow access to the route.
      } else {
        router.navigate(['/login']); // No session found, send to login.
        return false;
      }
    })
  );
};