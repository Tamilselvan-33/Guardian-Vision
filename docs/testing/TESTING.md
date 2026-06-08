# Testing Strategy

## Test Matrix

| Layer | Test Type | Coverage Target |
| --- | --- | --- |
| Frontend | Unit | Components, route protection, API error states |
| Frontend | E2E | Login, dashboard, incident creation, resolve flow |
| Backend | Unit | risk calculation, alert cooldown, aggregation |
| Backend | Integration | MongoDB route behavior, simulator, dashboard API |
| Detector | Unit | zone assignment, centroid tracking, density calculation |
| Security | Static checks | dependency audit, secret scanning |
| Performance | Load | dashboard API under polling traffic |

## Recommended Tools

- Vitest and React Testing Library for frontend.
- Supertest for Express routes.
- Playwright for end-to-end tests.
- k6 or Artillery for API load tests.
- npm audit and GitHub Dependabot for dependency hygiene.

## CI Gates

Required gates before merge:

1. Install dependencies.
2. Lint frontend/backend.
3. Build frontend.
4. Run unit tests.
5. Run backend API integration tests.
6. Run security audit.

