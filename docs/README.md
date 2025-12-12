# BulnaAI Documentation

## Quick Start

| Document | Purpose |
|----------|---------|
| [onboarding.md](./onboarding.md) | New developer setup guide |
| [product-overview.md](./product-overview.md) | Product features and tech stack |
| [implementation-plan.md](./implementation-plan.md) | Feature completion status |

## By Topic

### Authentication & OAuth
| Document | Description |
|----------|-------------|
| [google-oauth-console-setup.md](./google-oauth-console-setup.md) | Google OAuth configuration |
| [nextauth-cloud-run-setup.md](./nextauth-cloud-run-setup.md) | NextAuth.js + Cloud Run setup |
| [admin-user-setup.md](./admin-user-setup.md) | Admin account creation |

### Infrastructure & Deployment
| Document | Description |
|----------|-------------|
| **[DATABASE_URL_SETUP_GUIDE.md](./DATABASE_URL_SETUP_GUIDE.md)** | ⭐ 必読：正しいDATABASE_URL設定（検証済み） |
| **[LESSONS_LEARNED_DATABASE_CONNECTION.md](./LESSONS_LEARNED_DATABASE_CONNECTION.md)** | データベース接続トラブルシューティング |
| [cicd-current-status.md](./cicd-current-status.md) | CI/CD pipeline status |
| [cloud-sql-connection-guide.md](./cloud-sql-connection-guide.md) | Database connection setup |
| [terraform-production-setup.md](./terraform-production-setup.md) | Terraform configuration |
| [check-cloud-build-trigger.md](./check-cloud-build-trigger.md) | Cloud Build verification |
| [create-cloud-build-trigger-correct.md](./create-cloud-build-trigger-correct.md) | Cloud Build trigger setup |

### Payment (Stripe)
| Document | Description |
|----------|-------------|
| [stripe-integration-plan.md](./stripe-integration-plan.md) | Stripe implementation plan |
| [stripe-cloud-dev-setup.md](./stripe-cloud-dev-setup.md) | Stripe development setup |
| [stripe-terraform-setup.md](./stripe-terraform-setup.md) | Stripe + Terraform config |
| [stripe-price-id-setup.md](./stripe-price-id-setup.md) | Price ID configuration |
| [quick-setup-price-id.md](./quick-setup-price-id.md) | Quick Price ID setup |

### Admin Dashboard
| Document | Description |
|----------|-------------|
| [admin-dashboard.md](./admin-dashboard.md) | Admin panel features |
| [admin-api-design.md](./admin-api-design.md) | Admin API design |

### API & Development
| Document | Description |
|----------|-------------|
| [interface-spec.md](./interface-spec.md) | API contracts |
| [api-design-conversation.md](./api-design-conversation.md) | Conversation API design |
| [refactoring-use-conversations-hook.md](./refactoring-use-conversations-hook.md) | Refactoring notes |

### Testing
| Document | Description |
|----------|-------------|
| [testing-plan.md](./testing-plan.md) | Test strategy (Vitest/Playwright) |
| [manual-testing-procedure.md](./manual-testing-procedure.md) | Manual QA procedures |
| [testing-manual-dev.md](./testing-manual-dev.md) | Dev testing guide |
| [cloud-dev-testing-setup.md](./cloud-dev-testing-setup.md) | Cloud testing setup |
| [cloud-dev-testing-checklist.md](./cloud-dev-testing-checklist.md) | Testing checklist |

### Operations
| Document | Description |
|----------|-------------|
| [PR_CHECKLIST.md](./PR_CHECKLIST.md) | PR creation checklist |
| [delete-test-users.md](./delete-test-users.md) | Test data cleanup |
| [github-actions-test-results.md](./github-actions-test-results.md) | Test results |

### Secrets & Security
| Document | Description |
|----------|-------------|
| [SECRET_SCANNING_UNBLOCK.md](./SECRET_SCANNING_UNBLOCK.md) | GitHub secret scanning |
| [TERRAFORM_IMPORT_SECRETS.md](./TERRAFORM_IMPORT_SECRETS.md) | Secret import process |

### Historical
| Document | Description |
|----------|-------------|
| [handoff-2025-11-13.md](./handoff-2025-11-13.md) | Nov 2025 handoff notes |
| [archived/](./archived/) | Historical fix logs (37 files) |

## Root Documentation

- **[CLAUDE.md](../CLAUDE.md)** - Primary development guide with architecture, commands, and API routes
