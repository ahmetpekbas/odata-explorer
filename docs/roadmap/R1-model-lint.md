# R1 — Model lint

[Roadmap](README.md) · [Plan](../PLAN.md)

- **Status:** post-v1. When it is picked up, split each item into tasks sized as described in the [roadmap](README.md#how-to-use-this-roadmap).
- **Needs:** v1

- [ ] **R1.1** A rule engine on top of `diagnostics.ts`, where each rule declares its ID, severity, and
  a check function.
- [ ] **R1.2** Rules: unresolved types, entity types without keys (unless abstract or derived),
  annotation targets that point nowhere, navigation bindings whose paths or targets don't exist,
  partner mismatches.
- [ ] **R1.3** A lint panel with filters, jump-to-element, and "copy report as Markdown".
