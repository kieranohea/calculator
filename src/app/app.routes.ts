import { Routes } from '@angular/router';
import { Calculator } from './calculator/calculator';

export const routes: Routes = [
  { path: '', redirectTo: 'calc', pathMatch: 'full' },
  { path: 'calc', component: Calculator },
];

