# Structured field extraction prompt

Given the caller transcript (in any language), extract the following fields in English:

- `issue_type` — short label (e.g. "medical", "noise complaint", "fire")
- `location` — best available address or landmark; null if unknown
- `urgency` — one of `emergency` / `urgent_non_emergency` / `standard`
- `summary` — one sentence, <= 25 words, English
- `detected_language` — ISO 639-1 code

Return strict JSON matching the schema. Do not invent details the caller did not provide.
