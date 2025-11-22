# TODO

> Goal: Bring feature parity with [georgmangold/console](https://github.com/georgmangold/console) while maintaining our project's architecture

## ✅ Completed Features

### Core Features (Implemented)
- [x] Garage health status monitoring
- [x] Cluster and layout management
- [x] Bucket creation, viewing, and updates
- [x] Access key creation and assignment
- [x] Integrated object/bucket browser
- [x] Authentication system (bcrypt-based)
- [x] Config file auto-detection (garage.toml)

### Recent Additions (2025-11-22)
- [x] **Object Search Feature**
  - Search input on browse page
  - Filters folders and objects by name
  - Case-insensitive, with clear button
  - Location: `src/pages/buckets/manage/browse/`

- [x] **Build System**
  - Makefile for automated builds
  - Password generator tool (`make gen-password`)
  - Clean artifact management
  - Proper frontend/backend integration

- [x] **Code Organization**
  - Refactored gen_password.go to tools/
  - Separate Go module for utilities
  - Cleaner Makefile without workarounds

## 🎯 Priority Features (Missing from georgmangold/console)

### Dashboard & Monitoring
- [ ] **Metrics Dashboard**
  - Real-time server metrics visualization
  - Storage utilization charts
  - Performance graphs (CPU, memory, network)
  - Historical data tracking
  - Export metrics data

- [ ] **Performance Testing**
  - Built-in speedtest tool (Ctrl+K shortcut)
  - Upload/download throughput measurement
  - Latency testing
  - Results visualization and comparison

- [ ] **Watch/Events Page**
  - Real-time event tracking
  - Cluster state changes
  - Object operations logging
  - Notification system

### Bucket Management
- [ ] **Bucket Policies**
  - Policy editor UI
  - Get/Put/Delete policy management
  - IAM policy integration
  - Policy templates

- [ ] **Bucket Notifications**
  - Configure event notifications
  - Webhook support
  - Event type filtering
  - Notification testing interface

- [ ] **Bucket Quota Management**
  - Set size limits per bucket
  - Usage tracking and alerts
  - Quota visualization

- [ ] **Bucket Replication**
  - Configure replication rules
  - Cross-region replication
  - Replication status monitoring

### User & Access Control
- [ ] **Admin User Management**
  - Create/delete admin users
  - Granular permission assignment
  - Role-based access control (RBAC)

- [ ] **IAM Policy Management**
  - Policy editor for S3 actions
  - Admin action policies
  - Policy validation
  - Pre-built policy templates

- [ ] **SSO Integration**
  - OIDC/SAML support
  - Enterprise authentication
  - User group mapping

### Object Browser Enhancements
- [ ] **Advanced Filtering**
  - Filter by date range
  - Filter by size
  - Filter by file type/extension
  - Custom metadata filters

- [ ] **Bulk Operations**
  - Multi-select checkbox UI
  - Bulk delete
  - Bulk download (as ZIP)
  - Bulk metadata updates
  - Bulk move/copy

- [ ] **Upload Improvements**
  - Drag & drop file upload
  - Multi-file upload queue
  - Upload progress indicator (per file)
  - Pause/resume uploads
  - Multipart upload handling
  - Folder upload support

- [ ] **Object Operations**
  - Folder creation UI
  - Object move/rename
  - Object copy between buckets
  - Object metadata viewer/editor
  - Object versioning support
  - Presigned URL generator with expiry

### UI/UX Improvements
- [ ] **Command Palette**
  - Ctrl+K shortcut for quick actions
  - Search across all features
  - Recent commands history
  - Keyboard navigation

- [ ] **Pagination**
  - Server-side pagination for large lists
  - Configurable page size
  - Virtual scrolling for performance

- [ ] **Theme System**
  - Dark/light mode toggle
  - System theme detection
  - Custom theme colors
  - Persistent preference

- [ ] **Responsive Design**
  - Mobile-optimized layouts
  - Touch-friendly controls
  - Adaptive navigation

### Region & Multi-Site
- [ ] **Region Management**
  - Multi-region configuration
  - Region-specific settings
  - Cross-region operations
  - Region status indicators

### DevOps & Quality
- [ ] **Testing**
  - Unit tests (Frontend & Backend)
  - Integration tests
  - E2E tests with Playwright/Cypress
  - Test coverage reporting

- [ ] **CI/CD**
  - GitHub Actions workflows
  - Automated builds on commit
  - Multi-arch Docker builds (amd64, arm64)
  - Automated release process
  - Changelog generation

- [ ] **Documentation**
  - API documentation
  - User guide/wiki
  - Architecture diagrams
  - Contributing guidelines

## 🔧 Technical Improvements

### Performance
- [ ] Server-side search for objects
- [ ] Lazy loading for large object lists
- [ ] Image thumbnail generation
- [ ] Response caching
- [ ] WebSocket for real-time updates

### Security
- [ ] CSRF protection
- [ ] Rate limiting
- [ ] Audit logging
- [ ] Security headers
- [ ] Input sanitization review

### Code Quality
- [ ] ESLint/Prettier enforcement
- [ ] Go code linting (golangci-lint)
- [ ] Pre-commit hooks
- [ ] Code review guidelines
- [ ] Dependency updates automation

## 📝 Notes

### Current Architecture
- Frontend: React + TypeScript + Vite + TanStack Query + DaisyUI
- Backend: Go HTTP server proxying Garage Admin API
- Build: Makefile-based with embedded UI

### Design Principles
- Keep UI/UX simple and intuitive
- Maintain single-binary deployment
- Preserve auto-config from garage.toml
- Support both Docker and standalone deployments

### Feature Priority Order
1. Metrics Dashboard (high visibility feature)
2. IAM/Policy Management (security critical)
3. Bucket policies and notifications
4. Advanced object browser features
5. Performance testing and monitoring
6. SSO and enterprise features

### Compatibility Goals
- Maintain compatibility with Garage v2.0+
- Support same deployment methods as current
- Preserve existing configuration system
- Keep lightweight footprint (< 20MB binary)
