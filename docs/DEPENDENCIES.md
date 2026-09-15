# Dependency Audit

## Scope

This audit answers four questions:

1. Which packages are declared?
2. Which packages the audit feature actually uses?
3. Which packages are build/test tooling?
4. Are any declarations duplicated or currently unused?

This combines a local manifest/source-usage review with an npm registry vulnerability audit performed on 2026-09-15.

## Environment scanned

| Item                                | Version         |
| ----------------------------------- | --------------- |
| Node.js                             | 22.23.1         |
| npm                                 | 10.9.8          |
| package manager declared by project | npm 10.9.2      |
| Angular packages installed          | 21.2.23–21.2.24 |
| TypeScript installed                | 5.9.3           |
| RxJS installed                      | 7.8.2           |
| Vitest installed                    | 4.1.11          |

Commands used:

```bash
npm ls --depth=0
node --version
npm --version
rg "tailwind|@angular/forms|FormsModule|ReactiveFormsModule" .
npm audit --json
npm test -- --watch=false
npm run build
```

## Runtime and application dependencies

| Package                   | Manifest range | Installed | Required by current app? | Usage                                                                  |
| ------------------------- | -------------- | --------: | ------------------------ | ---------------------------------------------------------------------- |
| @angular/core             | ^21.2.0        |   21.2.23 | Yes                      | Components, dependency injection, lifecycle, application configuration |
| @angular/common           | ^21.2.0        |   21.2.23 | Yes                      | HttpClient APIs                                                        |
| @angular/platform-browser | ^21.2.0        |   21.2.23 | Yes                      | bootstrapApplication                                                   |
| @angular/router           | ^21.2.0        |   21.2.23 | Yes                      | Root and lazy audit routes                                             |
| @angular/compiler         | ^21.2.0        |   21.2.23 | Keep                     | Standard Angular application dependency/toolchain compatibility        |
| rxjs                      | ~7.8.0         |     7.8.2 | Yes                      | Observable responses and explicit subscribe flows                      |
| tslib                     | ^2.3.0         |     2.8.1 | Yes                      | TypeScript runtime helpers used by Angular output                      |
| tailwindcss               | ^4.3.2         |     4.3.3 | Build-time use           | src/styles.css imports tailwindcss                                     |
| @angular/forms            | ^21.2.0        |   21.2.23 | Not currently imported   | Native value/change/input bindings implement the current filters       |

## Development dependencies

| Package               | Manifest range | Installed | Purpose                                          |
| --------------------- | -------------- | --------: | ------------------------------------------------ |
| @angular/build        | ^21.2.1        |   21.2.24 | Application and test builders                    |
| @angular/cli          | ^21.2.1        |   21.2.24 | ng commands, serve, build, test, scaffolding     |
| @angular/compiler-cli | ^21.2.0        |   21.2.23 | Angular template/AOT compilation                 |
| typescript            | ~5.9.2         |     5.9.3 | Type checking and compilation                    |
| vitest                | ^4.0.8         |    4.1.11 | Unit and interaction test runner                 |
| jsdom                 | ^28.0.0        |    28.1.0 | Browser-like DOM for tests                       |
| prettier              | ^3.8.1         |     3.9.6 | Code and documentation formatting                |
| postcss               | ^8.5.3         |    8.5.28 | CSS processing                                   |
| @tailwindcss/postcss  | ^4.1.12        |     4.3.3 | Tailwind/PostCSS integration                     |
| tailwindcss           | ^4.1.12        |     4.3.3 | CSS build tooling; also declared in dependencies |

## What this feature imports directly

| Feature need                       | Package/API                                                               |
| ---------------------------------- | ------------------------------------------------------------------------- |
| Standalone component and injection | @angular/core                                                             |
| API requests                       | HttpClient and HttpParams from @angular/common/http                       |
| Routing and lazy loading           | @angular/router                                                           |
| API streams and cancellation       | Observable and Subscription from rxjs                                     |
| Tests                              | Angular testing utilities, HttpTestingController, RxJS of, Vitest runtime |

The audit-view feature does not import Angular Material, CDK, Bootstrap, PrimeNG, AG Grid, an icon package, a date library, or a form library.

## Findings

### 1. No additional dependency is required

Every implemented requirement is covered by the existing stack:

- Dynamic columns: TypeScript and Angular templates.
- HTTP integration: Angular HttpClient.
- Subscription handling: RxJS.
- Filters: native inputs/selects and component logic.
- Pagination: response metadata and native buttons/select.
- Styling: the existing Tailwind global import, HEIC global base rules, and component-scoped audit CSS.
- Tests: Angular builder, Vitest, and jsdom.

### 2. Tailwind is declared twice

tailwindcss appears in both dependencies and devDependencies with different declared ranges:

- dependencies: ^4.3.2
- devDependencies: ^4.1.12
- installed resolution: 4.3.3

The build currently succeeds. For a future cleanup, keep one aligned declaration—normally in devDependencies when Tailwind is only a build tool—and regenerate package-lock.json with npm install. This documentation task intentionally does not alter the previously supplied dependency set.

### 3. Angular Forms is currently unused

@angular/forms is installed but no FormsModule, ReactiveFormsModule, FormControl, or FormGroup import exists in application source.

It can remain because it was part of the supplied dependency set and may be useful if the filter builder later moves to reactive forms. The present implementation does not require it.

### 4. npm reports two extraneous installed packages

npm ls --depth=0 reports:

- @napi-rs/wasm-runtime 1.2.4
- @tybys/wasm-util 0.10.4

They are present in node_modules but not declared as project-level dependencies. They may be artifacts of optional/native tooling installation. A future maintenance pass can run npm prune after confirming no local workflow depends on them. They are not imported by the application.

### 5. Installed patch versions are newer than manifest baselines

Caret and tilde ranges allow npm to install compatible newer versions. The project currently resolves Angular 21.2.23/24, TypeScript 5.9.3, and Vitest 4.1.11 while retaining the original ranges in package.json.

package-lock.json remains the reproducible source for npm ci.

### 6. Registry vulnerability audit is clean

npm audit reported zero known vulnerabilities in the current lockfile dependency graph:

| Severity | Count |
| -------- | ----: |
| Info     |     0 |
| Low      |     0 |
| Moderate |     0 |
| High     |     0 |
| Critical |     0 |
| Total    |     0 |

The npm report counted 603 packages across production, development, and optional dependency relationships. This result is a time-specific registry result, so CI should continue running the organization's approved dependency scanner.

### 7. Audit UI styling does not require Tailwind utilities

src/styles.css imports tailwindcss, but no project-level PostCSS configuration file was found. The Audit Viewer uses native CSS in `audit-view.css` with Angular component encapsulation and does not rely on Tailwind utility classes. Tailwind and its PostCSS packages remain documented because they were part of the supplied dependency set; no new styling dependency is needed.

## Dependency decision matrix

| Proposed addition        | Decision          | Reason                                                                   |
| ------------------------ | ----------------- | ------------------------------------------------------------------------ |
| Angular Material/CDK     | Do not add        | Native controls and scoped CSS already meet the design                   |
| AG Grid or another grid  | Do not add        | Dynamic tables, expansion, and paging are already implemented            |
| Lodash                   | Do not add        | Native arrays, sets, maps, and string APIs are sufficient                |
| Moment/date-fns          | Do not add        | ISO dates are handled with Date.parse and DatePipe                       |
| State-management library | Do not add        | Feature state is local and bounded                                       |
| Icon library             | Do not add        | Existing inline icons and text controls are sufficient                   |
| Reactive forms package   | Already available | @angular/forms is installed but not needed by the current implementation |

## Recommended maintenance actions

These are recommendations, not prerequisites for running the feature:

1. Align the duplicate Tailwind declaration during a dedicated dependency-cleanup change.
2. Decide whether @angular/forms is part of the intended future architecture.
3. Run npm prune in a controlled cleanup if the two extraneous modules are unwanted.
4. Use npm ci in CI so the lockfile controls exact versions.
5. Run the organization's approved vulnerability scanner in CI.
6. Keep Angular packages on the same minor/patch line when upgrading.

## Verification result

- Dependency tree resolved successfully.
- No missing direct dependency was reported.
- npm audit reported zero known vulnerabilities on 2026-09-15.
- The application compiles.
- All 18 tests pass.
- Production build completes without warnings.
