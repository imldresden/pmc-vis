## Drone Delivery Model (PRISM)

An MDP (Markov Decision Process) modeling a battery-powered delivery drone
that must fly packages from a base to three targets and return, while risking
a crash on every flight.

### Overview

The drone starts fully charged at the **base** and can be directed to deliver
to **Target A**, **Target B**, or **Target C**. Each flight drains the battery
and carries a probability of crashing that grows as the battery gets weaker.

### State

The model is split across two synchronized modules:

- **`drone_battery`** — tracks the battery level, an integer from `0` to `5`
  (starts full at `5`).
- **`drone_location`** — tracks the drone's location (`Base`, `Target A/B/C`,
  or `Crashed`) and three boolean flags recording whether each target has been
  delivered.

Battery levels are grouped into ranges that determine the crash risk:

| Band   | Battery | Crash probability |
|--------|---------|-------------------|
| Full   | 5       | 0.01              |
| Medium | 3–4     | 0.10              |
| Low    | 1–2     | 0.20              |
| Empty  | 0       | — (deadlocked)    |

### Actions

| Action          | Requires        | Battery cost | Effect |
|-----------------|-----------------|--------------|--------|
| `charge`        | at base         | +1           | Recharge by one level |
| `fly_target_a`  | at base, ≥2     | −2           | Deliver to Target A (or crash) |
| `fly_target_b`  | at base, ≥1     | −1           | Deliver to Target B (or crash) |
| `fly_target_c`  | at base, ≥3     | −3           | Deliver to Target C (or crash) |
| `return`        | away from base, not crashed, ≥1 | set to 1 | Fly back to base (or crash) |

Every flight and return has two probabilistic outcomes: **success** (reach the
destination, and for deliveries set the corresponding `delivered_*` flag) or
**crash** (move to the `Crashed` state), weighted by the battery band's crash
probability. A drone that reaches the `Crashed` state or runs out of battery
away from base has no further moves.

### Labels

- **`crashed`** — the drone is in the crashed state.
- **`all_delivered`** — all three targets (A, B, and C) have been delivered.

These support properties such as the maximum probability of delivering to all
targets, or the minimum probability of ever crashing, e.g.:

    Pmax=? [ F "all_delivered" ]
    Pmin=? [ F "crashed" ]
    multi(P>=0.5 [F "all_delivered"], P>=0.75 [G !"crashed"])