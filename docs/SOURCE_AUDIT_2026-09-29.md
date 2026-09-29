# FLYMPUS source audit — 2026-09-29

This audit covers all four supplied archives before implementation: EP, IP, Technician, and QRH/Emergencies. The extraction inventory contained 283 files (281 unique by SHA-256); 272 yielded machine-readable text. The non-text items were image-only documents, URL shortcuts, or malformed legacy workbook copies. No unreadable item was used to invent a requirement.

## Architecture decision

The implemented ownership chain is `Profession → Phase → Platform → Training purpose / source definition → context → tracks → resolved suit`.

- Aerostar is a platform beneath Full Scale for EP, IP, and Technician. It is never modeled as a phase.
- EP, IP, and Technician retain separate syllabus, assessment, progression, and experience definitions.
- The Aerostar QRH/emergency catalog is platform-owned. A training suit stores only its applicable emergency IDs.
- Course edits are overlays stored separately from the source defaults. They can change applicability, order, minimum, supervision, track, exams, criteria, progression gates, counters, and required emergencies.
- Day and Night are tracks. A mixed EP course composes Day and Night packages without creating another phase or course type.

## Authoritative baselines used

| Profession / layer | Source baseline | Revision |
|---|---|---|
| EP | Existing modular EP catalog and current uploaded instructor/trainee syllabi | Current repository baseline / Edition F where stated |
| IP | Aerostar IP Course Syllabus GCS-D | Edition J |
| IP configuration | Aerostar IP Course Syllabus GCS-C | Edition I |
| IP conversion | Aerostar Israeli IP Conversion Syllabus | Edition C |
| IP supplementary | Aerostar Internal Pilot Supplementary Course Syllabus | Edition A |
| Technician | Aerostar BP Technician Course Syllabus, ASA108.0416 | Edition H, 2023-06-26 |
| Technician counters | Technicians Course Tracker Aerostar.xlsx | Supplied workbook |
| Platform emergencies | Aerostar flight manuals / QRH archive | Multiple historical and customer revisions |

Brakes and COMMINT Edition A packages are retained as customer-specific qualification definitions for IP and Technician.

## Preserved conflicts / review flags

1. Technician Edition H states a final theoretical qualification grade of 90 in the qualification section, while its theory table states 90 for Limitations and 85 for the final theory exam. Both assertions are preserved; the model flags the conflict instead of silently choosing one.
2. The QRH archive contains multiple historical, configuration-specific, and customer-specific revisions. The platform catalog is reference-only until a course pins an approved operative manual revision. Procedure text is therefore not presented as operational authority.
3. IP GCS-C Edition I and GCS-D Edition J are explicit source-definition variants. The course builder requires a variant selection rather than silently selecting one.

## Experience model

Experience is stored as typed counters with stable IDs, units, profession/phase/platform applicability, minimums, supervision, and provenance. Technician Edition H produces task-level repetition counters (including installation/removal, assembly/disassembly, inspections, maintenance and functional work) plus separate flight-role counters from the tracker workbook. It is not reduced to a flight count.
