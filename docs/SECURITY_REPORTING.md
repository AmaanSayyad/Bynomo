# Security Reporting (Disclosure & Incident Workflow)

If you discover a security vulnerability, please report it responsibly so we can fix it quickly without harming users.

## What to include in your report

Please provide as much of the following as you can:

- A clear title and impact summary (what can an attacker do, and what is the worst-case outcome?)
- Affected component(s)
  - Route(s) (example: `app/api/...` or `app/api/admin/...`)
  - Database table(s)/view(s) (example: `bet_history`, `user_balances`, `waitlist`)
  - Smart contract(s) (if applicable)
  - Auth/session layer (Privy / wallet connect / admin authorization)
- Steps to reproduce
  - Exact request(s) and payload(s) (redact any secrets)
  - Error messages and timestamps
  - Example accounts/addresses to use (avoid real user data)
- Evidence
  - Screenshots/log excerpts
  - Links to relevant code locations
  - If you can, a minimal proof-of-concept (PoC)
- Severity suggestion (Critical/High/Medium/Low) and reasoning

## Where to report

- Email: `partnerships@bynomo.fun`
- If GitHub security features are enabled for this repo, you can also use the platform’s security reporting flow.

## What we will do after receiving a report

1. Triage
   - Confirm scope and reproduce internally when possible.
   - Request additional details if needed.
2. Mitigation
   - Apply a patch or temporary mitigation (rate limits, route hardening, cache/timeout tuning, policy changes).
   - Rotate secrets if there is any suspicion of exposure.
3. Fix & verification
   - Deploy the fix and verify it with regression tests / targeted checks.
4. Communication
   - Acknowledge receipt.
   - Share next steps when appropriate.
5. Post-incident review (if applicable)
   - Root cause analysis and concrete prevention steps.

## Security areas to watch (what “good reports” often cover)

- Money movement / balance integrity
  - Bet settlement and payout validation
  - Deposit/withdraw flows and fee calculations
  - RPC/service role usage on server routes
  - Preventing unauthorized balance updates
- Data access control
  - RLS policies on Supabase tables
  - Admin endpoints authentication/authorization
  - Preventing leaderboard or analytics poisoning
- Admin & operational security
  - Admin dashboards should not leak sensitive data
  - Logs should support incident investigation (without leaking secrets)
- Supply chain / dependency risks
  - Suspicious install/postinstall scripts
  - Abnormal dependency changes

## During active incidents (DDoS/outage)

If you suspect an active attack or widespread outage:

- Include timeframe and affected endpoints.
- Mention observed symptoms (timeouts, 5xx rates, cache failures).
- If possible, include any WAF/firewall indicators and approximate request rates.

