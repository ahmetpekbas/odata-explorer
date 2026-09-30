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
