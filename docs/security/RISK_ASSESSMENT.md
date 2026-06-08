# Security Risk Assessment

## Current Risk Level

Current security maturity: **MVP / demo-ready**, not yet enterprise-ready.

## Key Risks

| Risk | Severity | Current State | Mitigation |
| --- | --- | --- | --- |
| Plaintext passwords | High | Demo auth stores passwords directly | Use bcrypt/argon2 and password policy |
| Mock token | High | Login returns a fixed demo token | Use signed JWT or secure server sessions |
| Broad CORS | Medium | Backend allows all origins | Restrict to production frontend domain |
| Destructive endpoints | Medium | Clear-all endpoint exists | Add role-based authorization |
| Secrets exposure | High | Risk if `.env` is committed | Use `.gitignore`, Secrets Manager, SSM |
| Detector stream token fallback | Medium | Default token exists | Require configured production token |
| No rate limiting | Medium | API can be spammed | Add rate limiting and WAF in production |

## OWASP Notes

- Add authentication hardening before public deployment.
- Validate and sanitize API inputs.
- Restrict destructive endpoints to admin roles.
- Add audit logging for operator actions.
- Use HTTPS-only cookies or bearer tokens with short expiry.
- Avoid logging secrets or raw camera URLs.

## AI Security Notes

- Avoid storing raw video unless explicitly required.
- Treat camera URLs as secrets.
- Document model limitations and false positive/negative risk.
- Do not claim facial recognition; the current detector is people-count oriented.

