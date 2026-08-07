# Dashboard Navigation and Routing Design

## Status

Approved interactively on 2026-08-04. This document is awaiting final written review before implementation planning.

## Problem

The dashboard has twelve destinations in a horizontal tab bar. At the default 900 x 600 window size, later destinations such as Updates and Settings overflow into a horizontal scroll area with no visible scroll affordance. Users therefore do not know those destinations exist.

The Clients and Providers destinations also split one routing story across two screens. Clients configure tools that route requests into LegionIO, while provider instances show where LegionIO can send those requests.

Two related defects should be corrected with the layout work:

- Running extensions display `v-` when the daemon catalog does not provide a version, even though installed gem version data is available locally.
- Provider model lists are cached by provider family rather than provider instance. Multiple instances of one provider can therefore share or display the wrong model list. Model status dots currently represent `enabled`, not health, and should not be presented as model health.

## Navigation

Replace the horizontal tab bar with a persistent, labeled sidebar below the existing full-width title bar.

The sidebar is a flat list with no category headings. It remains visible at every supported window width and uses the existing SF Symbols, colors, typography, and selected-state treatment.

The destination order is:

1. Routing
2. Services
3. Logs
4. Identity
5. LLM
6. GAIA
7. MCP
8. Extensions
9. Workers
10. Updates
11. Settings

Routing replaces both Clients and Providers. Selecting any item changes the main content area as the current tabs do. The title bar, online status, version, and window frame restoration remain unchanged.

The sidebar is 168 points wide. The content area must continue to work at the existing 700-point minimum window width and the 900 x 600 default size.

## Routing Page

Routing uses one page-level vertical scroll view. It must not contain nested client or provider scroll views.

### Client Routing

The first section preserves the current Clients content and behavior:

- Claude Code, Codex/ChatGPT, and Kai cards
- Installed state
- LegionIO/native routing controls
- Open or install actions
- Aggregate `routing: active` or `routing: inactive` status

Client cards use a 60-point minimum height so the beginning of the provider section is visible at the default window height. No client configuration behavior changes are part of this work.

### Divider

A simple horizontal divider separates client routing from providers. It is not a card or a labeled category band.

### LLM Providers

The second section reuses the current Providers visual design: a dense, flat list of provider-instance cards. Do not add a provider-family accordion or another level of navigation.

Each card represents exactly one `(provider, instance)` pair and displays:

- Provider family and instance name
- Credential fingerprint when available
- Capabilities
- Tier
- Instance health dot
- Exact circuit state
- Expand/collapse control

Cards are sorted by provider family and then instance so related instances remain adjacent.

Expanding a provider-instance card lazily loads models for that exact provider and instance. Model rows preserve the current compact presentation of operation type, model name, context size, and capabilities.

Model rows do not display health dots or health labels. Providers such as Bedrock can expose hundreds of models, and model-level health would add noise without helping the normal operational workflow. A model whose inventory record has `enabled: false` displays a neutral `disabled` metadata label without a status dot; it is not presented as circuit health.

The existing `no models registered` empty state remains.

## Provider Health Semantics

Circuit health is scoped to the provider instance.

Use the `health.circuit_state` returned for each provider-instance entry by `GET /api/llm/providers`. Display states as:

- `closed`: green, healthy
- `half_open`: yellow, recovering
- `open`: red, unhealthy
- Missing or unrecognized state: gray, unknown

Do not infer healthy from registration, model presence, `enabled`, tier, or capabilities. Missing health must never render green.

The UI does not need a provider-family aggregate status because the design intentionally retains the flat provider-instance list.

Before implementation, validate these mappings against a live daemon response. The daemon was not listening on port 4567 during design inspection, so endpoint behavior was verified from the current `legion-llm` endpoint implementation and specs instead of a live payload.

## Data Loading and Cache Identity

The provider list continues to load from `GET /api/llm/providers`.

Provider models load from `GET /api/llm/providers/:provider/models` with the instance query parameter, for example:

```text
GET /api/llm/providers/bedrock/models?instance=env_bearer
```

Provider model cache and loading-state keys use the full provider-instance identity, such as `bedrock:env_bearer`, rather than provider family alone. Expanding one Bedrock instance must not populate or suppress loading for another Bedrock instance.

Refreshing providers clears all provider-instance model caches. A failed model request shows a compact instance-local error with a retry action; it must not silently claim that no models are registered.

`GET /api/llm/offerings` is not required for this screen because model health is intentionally excluded. It remains the detailed offering inventory and is not reimplemented in Interlink.

## Extensions and Updates

Extensions and Updates remain separate sidebar destinations.

- Extensions answers what can be installed, what is installed, and what is running.
- Updates maintains LegionIO core libraries, extensions, the CLI, and Interlink itself.

Updates displays a compact count badge in the sidebar only when updates are available. No badge is shown for zero updates or before the first successful update check.

Running extension cards should display the installed gem version when the daemon extension catalog omits version data. Parse the newest installed version from `legion-gem list`, map versions by gem name, and use that value as the fallback for running cards. If no trustworthy version exists from either source, omit the version label instead of rendering `v-`.

## Component Boundaries

Implementation should preserve the existing behavior while removing view-owned scrolling that prevents composition:

- `StatusWindowView` owns the title bar, sidebar selection, and destination content switch.
- A Routing view owns the single page scroll and composes client and provider sections.
- Client routing controls remain responsible for client detection, persisted routing state, and config changes.
- The provider section remains responsible for search, refresh, provider-instance expansion, and model loading.
- `DaemonCache` owns provider and provider-instance model data, loading state, and errors.

Do not duplicate client configuration or provider parsing logic inside the new container view.

## Error and Empty States

- If the daemon is unavailable, preserve the existing provider load error and retry behavior.
- If provider health is missing, display unknown rather than healthy or unhealthy.
- If one instance's model request fails, keep other provider instances usable.
- If no providers are registered, show the existing provider empty state below the client section.
- If updates cannot be checked, do not display a stale or fabricated update badge.

## Acceptance Criteria

- All eleven destinations are visible at 700 x 520 and 900 x 600 without horizontal scrolling.
- Routing is the default destination and contains all three client cards followed by the provider section.
- The provider section visually matches the current provider-instance cards.
- Provider instances with `closed`, `half_open`, `open`, and missing circuit states render green, yellow, red, and gray respectively.
- Model rows have no health dot or circuit-health label.
- Expanding two instances from the same provider returns and caches distinct model lists.
- A failed model fetch is distinguishable from an empty model list.
- Updates remains separate and shows a count badge only when updates are available.
- Running extension cards show a real installed version or no version label; they never show `v-`.
- Existing client routing actions and provider model expansion continue to work.
- The project builds successfully with `swift build`.
- The completed UI is visually checked at the minimum and default window sizes.

## Release Documentation

The implementation must update `VERSION`, `CHANGELOG.md`, and the README dashboard destination table in the same change, following this repository's existing release requirements.

## Out of Scope

- Merging Extensions and Updates
- Displaying per-model or per-offering health
- Adding provider-family accordion nesting
- Changing circuit-breaker behavior in `legion-llm`
- Changing client routing configuration formats
- Redesigning the title bar or individual destination content unrelated to this work
