# Connecting the debugger to AI Studio

The prototype runs on sample data. Going live means replacing four small seams in the service and adding two entry points in the frontend. Everything else (link parsing, rules, redaction, validation, API) stays as it is.

## 1. Mount the module in the backend

The service is built to live inside the existing `api.galleri5.com` backend rather than as a new microservice.

```python
from diagnostics.api import router, current_user
from diagnostics.service import DiagnosticsService

app.include_router(router)
app.dependency_overrides[current_user] = firebase_user_dependency   # the backend's existing auth
app.state.diagnostics = DiagnosticsService(
    source=AIStudioEvidenceSource(...),
    access=ProjectAccessPolicy(),
    tickets=SupportTicketClient(...),
)
```

Give the module a **read-only** database role.

## 2. Evidence source

Implement `diagnostics.sources.EvidenceSource`:

| Method | Reads from | Fields used |
|---|---|---|
| `get_generation(inference_id)` | Inference record | `inference_id`, `jobrouter_job_id`, `unit_session_id`, `org_id`, `model_path`, `model_label`, `status`, `created_at`, `started_at`, `completed_at`, `error`, `error_message`, `error_detail.raw_error`, `notice_code` (if present), `http_status` (if present) |
| `find_by_job(jr_id)` | Inference record by `jobrouter_job_id` | as above |
| `get_session(unit_session_id)` | Unit session + its inferences | session title, inference list |
| `platform_counts()` | Aggregate over recent failures (last 60 min) | count and distinct workspaces per diagnostic code |

Optional but valuable:

- `timeline`: status changes from the Firestore `aistudio-jobs/{jr-id}` document or a Job Router history endpoint.
- `provider_status`: whether the provider finished. This is what turns "Our job system lost track" from Probable into Confirmed, and tells users whether a retry would charge twice.

## 3. Access policy

Replace `OrgAccessPolicy` with a call to the backend's existing project/workspace access check, so the debugger can never show more than the generation page would.

## 4. Support tickets

Replace `SampleTicketClient` with a call to the existing `POST /api/v1/support/tickets`, using category `generation` and the `job_id`, `inference_id` and `session_id` fields it already accepts. The comment carries the diagnosis ID and summary.

## 5. Frontend entry points

- **Sidebar:** add **Debugging** under the TOOLS group, routed to this page.
- **Failed results:** add a **Diagnose this generation** button that links to `/debugging?inference-id=<id>`.
- **Ticket form:** when someone picks "Generation failed or stuck", run the diagnosis first and show it. If they still submit, attach it.

## 6. Backend changes that raise accuracy

These aren't required to go live, but each one moves more answers from Probable to Confirmed:

1. Store structured failure fields on every inference: `error_code`, `failure_stage`, `provider`, `provider_request_id`, `provider_http_status`, `retryable`.
2. A read-only Job Router endpoint for a job's history: attempts, lease events, webhook receipt, provider status.
3. A correlation ID created at submit time and passed through the Job Router, the provider call and the logs.

## Rollout

1. **Shadow mode:** diagnose every new "generation" ticket automatically and show the result to admins only. They mark it right or wrong.
2. **Pilot:** turn on the Debugging page for one or two production teams with a server-side flag.
3. **Everyone:** once accuracy per category is good enough, add the Diagnose button everywhere.
