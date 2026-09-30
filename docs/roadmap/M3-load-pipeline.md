# M3 — Load pipeline & persistence

[Roadmap](README.md) · [Plan](../PLAN.md)

- **Demo:** A dropped file gets parsed in the background, shows its problems, and is remembered.
- **Needs:** [M1](M1-csdl-core-xml.md), [M2](M2-csdl-json.md)

- [x] **3.1 Parser worker.** Write `parser.worker.ts` with Comlink: detect the format (`<` vs `{`),
  parse, resolve, report progress by bytes, and return errors as data rather than throwing.
  *Done when:* a Vitest worker test (or the E2E smoke test) gets a model and progress events back.
- [x] **3.2 Store.** Write zustand `store.ts`: a map of documents (v1 shows one active document), the
  detail mode, and the selection.
  *Done when:* unit-tested reducers or actions.
- [ ] **3.3 Start page.** A drop zone, a file picker, a progress bar, and an error message for failed
  loads.
  *Done when:* dropping TripPin shows the type and set counts, and dropping a v2 file shows the
  "not supported" message.
- [ ] **3.4 Diagnostics panel.** A list with severity, message, and location. Selecting an entry
  navigates once M4 exists.
  *Done when:* the unresolved-type fixture shows its warnings.
- [ ] **3.5 Recent files.** Store files in IndexedDB (`idb`): save on load, list, reopen, forget, and
  clear all. Enforce a size budget with oldest-first eviction, and show "Stored only in this browser" on
  the start page.
  *Done when:* after a reload the file reopens without re-dropping, and forgetting it removes it.
