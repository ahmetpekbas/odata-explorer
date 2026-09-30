# Fixtures

Small, public `$metadata` documents used by the CSDL tests. They are committed unmodified, as served
(including the single-line formatting), because the source-span tests slice the exact original text.

| File | Source | Retrieved |
|---|---|---|
| `trippin.xml` | `https://services.odata.org/V4/TripPinServiceRW/$metadata` | 2026-09-30 |
| `northwind.xml` | `https://services.odata.org/V4/Northwind/Northwind.svc/$metadata` | 2026-09-30 |
| `aliases.xml` | Hand-written: two schemas referenced through aliases, an included vocabulary, overloads | n/a |
| `unresolved.xml` | Hand-written: one of each kind of unresolvable type reference | n/a |
| `expressions.xml` | Hand-written for this project: one example of every annotation expression form | n/a |

## Licensing

Both documents come from the public OData sample services run by the OData TC / odata.org (TripPin is
the service from the OData "Building a service" tutorial, Northwind the classic sample database). The
services state no separate license for their metadata; they exist as open demonstration endpoints, and
the documents are reproduced here only as test inputs. If a rights holder objects, remove the file and
the tests that use it.

Larger documents (Microsoft Graph) are downloaded on demand into the gitignored `fixtures/large/`
and are never committed.

## `csdl-schemas/`

The example documents of [`oasis-tcs/odata-csdl-schemas`](https://github.com/oasis-tcs/odata-csdl-schemas)
(`examples/`, commit `e6b66a96ec5f74edb0c0e192978a39f146f70d76`, retrieved 2026-09-30), each in CSDL XML
and in the CSDL JSON that the OASIS tooling generated from it. `src/csdl/parity.test.ts` asserts that both
forms of a pair produce the same model. Line endings are normalized to LF; the content is otherwise as
published. The repository's content is contributed by OASIS TC members and governed by the OASIS IPR
Policy; like the vocabularies, the files are reproduced here only as test inputs.

The `counterexamples/` directory is not included: it holds documents that are invalid on purpose.
