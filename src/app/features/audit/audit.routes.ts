import { Routes } from "@angular/router";

export const AUDIT_ROUTES: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./pages/audit-view/audit-view").then(
        (component) => component.AuditView,
      ),
  },
];
