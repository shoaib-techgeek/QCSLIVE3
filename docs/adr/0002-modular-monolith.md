# ADR-0002 — Modular monolith first

Status: Accepted (2026-11-01)

## Context
Target is Daraz/Temu-style multi-vendor commerce. Launch traffic does not justify microservices; premature splitting costs more than it saves.

## Decision
One deployable backend (`backend/`) with strict module boundaries under `backend/src/modules/<name>/`. Modules talk through public interfaces or domain events, never through each other's tables. Extract a module into a service only when a measured need (scaling, deploy contention, team ownership, failure isolation) exists, and record it as an ADR.

## Consequences
- Boundary rules are enforced in review now; add an architecture test (dependency-cruiser) before the third module lands.
- Cross-module side effects use a transactional outbox once the first cross-module event exists (planned with orders/inventory).
