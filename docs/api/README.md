# qeek API Reference (agent tools)

Tools are the agent-facing API. Full JSON schemas live in each plugin's `src/index.ts`.

## Math (verified)
- `mathcore_compute {expression, operation?}` → verified result + certificate
- `mathcore_check_answer {question, answer}` → MATCH | MISMATCH | UNCOMPARABLE | UNVERIFIABLE
- `mathcore_list_operations {}` → operation catalog

## Memory / vault
- `memory_create_note {title, content, tags?, links?}`
- `memory_search {query, tags?}`
- `memory_read_note {title}`
- `memory_list_tags {}`
- `vault_search {query, tags?, limit?, offset?}` (Tantivy)
- `vault_graph {vaultPath?, format?}` → nodes/edges/orphans/hubs or DOT

## Languages
- `language_detect {filePath, content?}`
- `language_analyze {filePath, content?, language?, includeMetrics?, includeIssues?}`
- `language_format {filePath, content, language?, options?}`
- `language_lint {filePath, content, language?, config?}`
- `language_run_tests {projectPath, language, testPath?, args?}`
- `language_get_tooling {language}`

## Capability awareness
- `capability_scan {deep?, category?}`
- `capability_check {capability, details?}`
- `capability_list {category?, status?}`
- `capability_adapt {task, preferences?}`
- `capability_report {format?, includeRecommendations?}`

## Code / project
- `code_review {filePath, content?}` → complexity, duplication, dead code, secrets
- `docs_generate {path, outDir?}`
- `project_health {projectPath}` → score + checks
- `security_scan {path, maxFiles?}` → findings + summary
- `tasks_schedule {tasks[]}` → scored + time-blocked

## System & hardware (`@qeek/qeek-sysinfo`, local-only)
- `sysinfo_snapshot {diskPath?, fresh?}` → full host snapshot (30s cache)
- `sysinfo_cpu {}`, `sysinfo_memory {}`, `sysinfo_disk {path?}`
- `sysinfo_gpu {}`, `sysinfo_battery {}` (best effort; unavailable = unknown)
- `sysinfo_network {}` → local interfaces only, never probes externally
- `sysinfo_check {minFreeMemBytes?, minFreeDiskBytes?, maxCpuPercent?}` → budget gate

## Telemetry / debug
- `telemetry_snapshot {}`
- `GET /debug/events`, `/debug/events/stats`, `/debug/events/trace/:id`, `/debug/events/export`

## Skills / workflows
- Skills: `daily-briefing`, `research`, `task-planning`, `code-review` (see `packages/assistant-skills`)
- `run_workflow {template, inputs?}` — templates: `research-report`, `code-review`, `daily-briefing`
