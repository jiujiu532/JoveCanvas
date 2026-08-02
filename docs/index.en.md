# JoveCanvas documentation index

JoveCanvas is an AI creation workspace for images, video, short drama, and brand assets. Repository: `jiujiu532/JoveCanvas`.

## Product & install

- [Features overview](/en/docs/overview/features)
- [Project structure & flows](/en/docs/overview/project-structure)
- [Page gallery](/en/docs/overview/page-gallery)
- [Quick start](/en/docs/overview/quick-start)
- [Configuration](/en/docs/overview/configuration)
- [Production readiness](/en/docs/overview/production-readiness)
- [Docker deployment](/en/docs/overview/docker)
- [Low-memory deployment](/en/docs/overview/low-memory)
- [Render deployment](/en/docs/overview/render)

## Creation & canvas

- [Canvas node manual](/en/docs/canvas/canvas-node-manual)
- [Canvas shortcuts](/en/docs/canvas/canvas-shortcuts)
- [Third-party prompt sources](/en/docs/overview/third-party-prompt-repositories)

## Development & data

- [Local development](/en/docs/backend/local-development)
- [API responses & sensitive config](/en/docs/backend/api-response)
- [Database schema](/en/docs/backend/backend-database)
- [Canvas data structures](/en/docs/backend/canvas-data-structure)

## Project governance

- [Community & acknowledgements](/en/docs/support/community)
- [Sponsorship](/en/docs/support/donate)
- [Commercial launch gaps](/en/docs/business/commercial-launch)
- [Open-source license](/en/docs/business/license)
- [Contributor agreement](/en/docs/business/cla)
- [Business cooperation](/en/docs/business/business)
- [Security & vulnerability reports](/en/docs/support/security)
- [Pending tests](/en/docs/progress/pending-test)
- [TODO](/en/docs/progress/todo)
- [Changelog](/en/docs/progress/changelog)

## Important notes

- PostgreSQL stores accounts, settings, tasks, points, orders, and operations data by default.
- Creative sessions, Canvas, personal assets, short drama, and workbench history are server-side; after login they restore across devices without browser business caches.
- Images, video, and audio are registered as media under the server data directory or optional S3-compatible object storage, managed from admin “local media” and “external storage”.
- Model and payment secrets are read or encrypted server-side only and are never returned through ordinary user APIs.
- Application image: `ghcr.io/jiujiu532/jovecanvas`; docs image: `ghcr.io/jiujiu532/jovecanvas-docs`.
- Environment variables keep the `VOZEB_PRO_` prefix; default database name/user remain `vozeb_pro`.
