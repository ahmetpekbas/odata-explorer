# Bundled vocabularies

The OASIS OData standard vocabularies (CSDL XML), used to resolve `edmx:Reference`s offline and to look
up term definitions. They are **generated**: do not edit them by hand.

- **Source:** <https://github.com/oasis-tcs/odata-vocabularies>, directory `vocabularies/`
- **Pinned commit:** `3e36ad2a4930a47feaf7a7cd0b78ed4f2bafcfb2` (2026-09-13)
- **Update:** change `COMMIT` in `scripts/fetch-vocabularies.ts`, run `npm run fetch:vocabularies`,
  and commit the result.
- **Vocabularies:** Core, Capabilities, Measures, Validation, Aggregation, Authorization, JSON,
  Repeatability, Temporal (all `V1`).

## License

The repository has no separate license file; its `LICENSE.md` says the content is contributed by OASIS
TC members and governed by the OASIS IPR Policy (RF on RAND mode). The files are reproduced unmodified
apart from line endings, which are normalized to LF.
