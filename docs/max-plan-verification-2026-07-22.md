# Z.AI Max verification — 22 July 2026

## Verified public claims

Z.AI's subscription page advertises the Max plan as:

- 20× Lite usage;
- intended for advanced users on mid-to-large repositories;
- first access to flagship models and features;
- "Dedicated resources during peak times."

Source: <https://z.ai/subscribe>

The separate Usage Policy says concurrency is tied to the plan tier but is
*dynamically adjusted based on resource availability*, with only the relative
ordering `Max > Pro > Lite`. It publishes no reserved-concurrency number,
availability target, queue-time target, or SLA.

Source: <https://docs.z.ai/devpack/usage-policy>

The GLM-5.2 launch page defines peak hours as 14:00–18:00 UTC+8 (06:00–10:00
UTC), and says GLM-5.2 consumes 3× quota during peak hours and 2× off peak
(with a temporary 1× off-peak promotion).

Source: <https://z.ai/blog/glm-5.2>

## Correct interpretation of the local transport sample

Observed output from pi-zai 0.5.3:

```text
stored rows / logical turns = 144
terminal transport errors   = 31
tcp_connect                 = 30
unknown_transport           = 1
request -> headers average  = 13.8 s
turn -> first delta average = 13.8 s
turn wall average           = 24.8 s
```

Calculations:

```text
terminal error rate = 31 / 144 = 21.53%
tcp_connect rate    = 30 / 144 = 20.83%
tcp share of errors = 30 / 31  = 96.77%
```

`Attempts` is the old 0.5.3 label. A stored row represents a completed logical
agent turn and its terminal result; internal wire retries are not separate
rows. These figures therefore must not be described as 31 failed provider
attempts out of 144 raw HTTP attempts.

The matching 13.8-second headers and first-delta averages indicate that the
measured silence occurs before the HTTP response/stream becomes visible, not
between headers and the first streamed content event.

The three-request doctor probe returned 2/3 successful. That is consistent
with intermittent endpoint or route failure, not a permanently unreachable
endpoint.

## Pricing correction

Z.AI's public API pricing table currently lists GLM-5.1 at:

```text
uncached input = $1.40 / 1M
cached input   = $0.26 / 1M
output         = $4.40 / 1M
```

It does not currently contain a GLM-5.2 row.

Source: <https://docs.z.ai/guides/overview/pricing>

Therefore the existing GLM-5.2 dollar arithmetic is a GLM-5.1-rate proxy for
economic comparison. It is not a published GLM-5.2 price and not the user's
Coding Plan bill. Version 0.5.4 labels this explicitly.

## Provider alias correction

Upstream Pi's canonical built-in provider IDs are:

- `zai` for the global Coding Plan endpoint;
- `zai-coding-cn` for the China Coding Plan endpoint.

The runtime in the observed session also exposes `zai-coding-plan`, a compatible
alias targeting the same global Coding Plan route. Version 0.5.3 did not include
that alias in its provider allowlists. Consequences after selecting the alias
included:

- `/zai-*` commands incorrectly warning that the model was not Z.AI;
- provider-boundary diagnostics and local metric hooks being skipped;
- subscription-managed cost interpretation not applying to the alias;
- status ownership becoming inaccurate.

Version 0.5.4 recognizes `zai-coding-plan` as a managed Coding Plan alias while
keeping it distinct from Pi's canonical native provider ID. It does not claim
that the alias itself is built into upstream Pi.

## Max-plan conclusion

The measurements do not prove that Z.AI has no internal priority allocation for
Max. They do show that the user-visible result is not equivalent to isolated,
reserved, or reliably available capacity:

- 21.53% terminal transport failures in the clean stored-turn sample;
- 96.77% of those failures classified as TCP/connectivity failures;
- 13.8 seconds average before headers/first visible delta;
- intermittent failures reproduced by the live doctor probe;
- failures observed while quota was not exhausted.

The technically precise question for Z.AI is therefore what "dedicated
resources" means operationally: priority scheduling, reserved concurrency,
isolated serving capacity, or another mechanism—and what success-rate and
queue-time targets Max users should expect during the published peak window.
