# Architecture Decision Records

Use an ADR for a decision with relevant alternatives or long-term consequences that would bloat `docs/TECHNICAL-DESIGN.md` (`docs/PROCESS.md` §5.2).

- File name: `ADR-NNN-short-slug.md`, starting from `ADR-001`, never reused.
- Copy `_TEMPLATE.md`, write the content in the project language.
- An ADR is created in the branch of the backlog item that takes the decision, and the item references it in `Design references`.
- Accepted ADRs are not rewritten: a changed decision gets a new ADR that supersedes the old one, whose state becomes `Superseded by ADR-NNN`.

| ADR | Title | State | Item |
| --- | ----- | ----- | ---- |
