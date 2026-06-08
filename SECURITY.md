# Security Policy

## Supported Versions

This project is currently in hackathon/MVP stage. Security fixes should target the main branch.

## Reporting a Vulnerability

Please report vulnerabilities privately to the maintainers. Include:

- Affected file or endpoint.
- Reproduction steps.
- Impact.
- Suggested mitigation if known.

## Production Security Checklist

- Replace demo auth with hashed passwords.
- Replace mock token with signed JWT or secure session auth.
- Restrict CORS to trusted origins.
- Store secrets in AWS Secrets Manager or SSM Parameter Store.
- Protect destructive API endpoints with admin authorization.
- Enable HTTPS.
- Add rate limiting.
- Add dependency scanning.
- Review logs for accidental secret exposure.

