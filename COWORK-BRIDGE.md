# Comet Bridge HTTP API

REST API server exposing all Comet-Bridge MCP tools as HTTP endpoints. Designed for environments that can't use MCP directly (sandboxed VMs, non-MCP clients, scripts).

## Starting the Server

```bash
cd <path-to-comet-mcp>
npm run build && npm run http
# Listening on http://localhost:3456
```

Set a custom port with `COMET_HTTP_PORT`:
```bash
COMET_HTTP_PORT=8080 npm run http
```

## Browsing Endpoints

All responses are JSON. All endpoints support CORS (`Access-Control-Allow-Origin: *`).

### Health Check
```http
GET /api/health
-> {
  "overall": "healthy" | "degraded" | "down",
  "ok": true,
  "components": {
    "browser": { "name": "browser", "status": "healthy" | "unreachable" | "degraded" | "unknown", "reason": null, "latency_ms": 0 },
    "comet-mcp": { "name": "comet-mcp", "status": "healthy", "reason": null, "latency_ms": 0 },
    "comet-monitor": { "name": "comet-monitor", "status": "healthy" | "unreachable" | "degraded" | "unknown", "reason": null, "latency_ms": 0 },
    "extension": { "name": "extension", "status": "healthy" | "unreachable" | "degraded" | "unknown", "reason": null, "latency_ms": 0 },
    "browser_cdp": { "status": "healthy" | "unreachable" | "degraded" | "unknown", "port": 9222, "detail": null },
    "comet_mcp": { "status": "healthy", "port": 3456, "build": "local" },
    "comet_monitor": { "status": "healthy" | "unreachable" | "degraded" | "unknown", "port": 5555, "detail": null }
  },
  "checkedAt": 1781132011678,
  "duration_ms": 0,
  "timestamp": "..."
}
```

The health endpoint returns this contract-shaped envelope before orchestrator initialization as well. `ok` remains true when the HTTP bridge itself is available and non-core monitoring surfaces are unavailable.

### Connect to Comet
```
POST /api/connect
-> { "message": "Connected to Perplexity (cleaned 0 old tabs)" }
```

### Send a Prompt (blocking)
```
POST /api/ask
Body: { "prompt": "...", "newChat": false, "timeout": 15000 }
-> { "status": "completed", "response": "..." }
-> { "status": "in_progress", "steps": [...], "message": "..." }
```

### Poll Agent Status
```
GET /api/poll
-> { "status": "completed", "response": "..." }
-> { "status": "working", "steps": [...], "currentStep": "..." }
```

### Stop Agent
```
POST /api/stop
-> { "stopped": true, "message": "Agent stopped" }
```

## Hub Orchestration Endpoints

These endpoints support the Computer/Spaces parent hub workflow used by Codex, Comet sidecar assistants, and browser-control agents.

### Delegate Work
```http
POST /api/delegate
Body: {
  "description": "contract validator computer delegation",
  "surface": "computer",
  "task_kind": "validation",
  "async": true
}
-> {
  "task_id": "computer-task-...",
  "surface": "computer",
  "state": "dispatched",
  "status": "pending",
  "payload": { "taskId": "computer-task-...", "task": { "...": "..." } },
  "duration_ms": 0,
  "tools_invoked": [],
  "steps_completed": 0,
  "steps_total": 0,
  "computer_task_url": "https://www.perplexity.ai/computer/tasks/...",
  "audit_ids": ["audit-..."]
}
```

Supported `surface` values are `computer`, `space`, `sidecar`, `browser`, and `shortwave`. Unknown values return HTTP `400`. `surface=sidecar` is compatibility-only and returns `Deprecation: true` plus a migration hint to use `surface=computer`. When the orchestrator is not initialized and no surface is supplied, delegation falls back to a Computer coordination task.

### Computer Tasks
```http
GET /api/computer/tasks
POST /api/computer/tasks
GET /api/computer/tasks/status?task_id=<id>
POST /api/computer/tasks/respond
GET /api/computer/tasks/artifacts
GET /api/computer/tasks/:id
POST /api/computer/tasks/:id/respond
GET /api/computer/artifacts/:id
```

Computer task creation accepts `description`, `title`, or `instructions` and records hub state plus audit metadata.

### Spaces
```http
GET /api/spaces
GET /api/spaces/search?q=<query>
POST /api/spaces/search
GET /api/spaces/metadata?space_id=<id>
POST /api/spaces/dispatch
GET /api/spaces/:id
POST /api/spaces/:id/tasks
```

Space search ranks open Comet Space tabs by task terms, inferred skills, Space title, and URL. Space dispatch records the selected Space, task URL, group metadata, and audit IDs.

### Screenshot
```
GET /api/screenshot
-> { "data": "<base64 PNG>", "mimeType": "image/png" }
```

### Get/Set Mode
```
POST /api/mode
Body: {}                       -> { "currentMode": "search" }
Body: { "mode": "research" }   -> { "mode": "research", "message": "Switched to research mode" }
```

## Tab Group Endpoints

Requires the Comet Tab Groups Bridge extension (see README.md for install instructions).

### List All Tab Groups
```
GET /api/tab-groups
-> { "groups": [{ "id": 123, "title": "Research", "color": "blue", "collapsed": false, "windowId": 456 }] }
```

### List All Tabs (with group assignments)
```
GET /api/tab-groups/tabs
-> { "tabs": [{ "id": 1, "groupId": 123, "title": "Page Title", "url": "https://...", ... }] }
```
Tabs with `groupId: -1` are ungrouped.

### Create Tab Group
```
POST /api/tab-groups
Body: { "tabIds": [1, 2, 3], "title": "My Group", "color": "blue" }
-> { "groupId": 789, "group": { "id": 789, "title": "My Group", "color": "blue", ... } }
```

### Update Tab Group
```
POST /api/tab-groups/update
Body: { "groupId": 789, "title": "New Name", "color": "red", "collapsed": true }
-> { "id": 789, "title": "New Name", "color": "red", "collapsed": true, ... }
```

### Delete Tab Group
```
POST /api/tab-groups/delete
Body: { "groupId": 789 }
-> { "deleted": true, "ungroupedTabs": 3 }
```

## Usage from Sandboxed Environments

For sandboxed VMs that can control Chrome via MCP but can't reach localhost directly, use Chrome's `fetch()` as a bridge:

```javascript
// Via Claude-in-Chrome javascript_tool on any Chrome tab:
const groups = await fetch('http://localhost:3456/api/tab-groups').then(r => r.json());

const result = await fetch('http://localhost:3456/api/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'Search for latest AI news', timeout: 30000 })
}).then(r => r.json());
```

## Concurrency

Only one CDP operation runs at a time (mutex). Concurrent requests receive `429`:
```json
{ "error": "Server busy - another operation is in progress. Try again shortly." }
```

## Error Handling

All errors return `{ "error": "description" }` with appropriate HTTP status:
- `200` success
- `400` bad request (missing params, invalid values)
- `404` unknown endpoint
- `429` server busy
- `500` internal error (CDP connection, Comet not running)
