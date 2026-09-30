# M2 — CSDL JSON

[Roadmap](README.md) · [Plan](../PLAN.md)

- **Demo:** JSON and XML versions of the same document produce the same model.
- **Needs:** [M1](M1-csdl-core-xml.md)

- [x] **2.1 JSON parser.** Write `parse-json.ts`: `$Version`, `$Reference`, `$EntityContainer`,
  namespace members with `$Kind`, overload arrays, `$Annotations`, and `@Term#Qualifier` keys. Normalize
  the JSON defaults to the model's defaults (`$Nullable`, `$Type`, and so on).
  *Done when:* the OASIS Core vocabulary JSON parses without diagnostics.
- [x] **2.2 Parity suite.** Commit both formats of the vocabularies and of the `oasis-tcs/odata-csdl-schemas`
  examples. The test asserts that each XML/JSON pair produces a deep-equal model, ignoring spans.
  *Done when:* every pair matches, and each mismatch it uncovered is fixed.
- [ ] **2.3 JSON source fragments.** Re-serialize the element's JSON subtree for the source panel.
  *Done when:* each element kind returns its fragment in tests.
