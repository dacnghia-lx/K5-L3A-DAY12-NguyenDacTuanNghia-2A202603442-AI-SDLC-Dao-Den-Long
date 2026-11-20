// Single source of truth for gameplay numbers (Ticket-02 standard values + Ticket-03 change
// request, Test Contract v1.2).
// game.contract.json "tuning" must match TUNING exactly (enforced by tests/contract.test.js).
export const TUNING = Object.freeze({
  player_speed: 6, // m/s on the XZ plane (velocity is set instantly: accel/stop in 0 s <= 0.1 s)
  carry_capacity: 10, // base; capacity = min(capacity_max, carry_capacity + 2 * successful_lights)
  capacity_max: 20,
  lantern_cost: 10, // first lighting
  relight_cost: 5, // a lantern that has been lit before (ever_lit)
  fuel_max: 100,
  fuel_decay_per_s: 1.0,
  fuel_per_mote: 10,
  drain_per_s: 5, // per draining shade
  low_fuel_threshold: 30, // fuel < 30: no safe zone, shades come to drain it
  win_ratio: 0.6, // win at dawn with >= ceil(0.6 * lanterns) lit
  lantern_count_night1: 5,
  pickup_radius: 1.0, // XZ, and |player feet Y - mote ground Y| <= pickup_height
  interact_radius: 2.0,
  pulse_cost: 3,
  pulse_radius: 5, // 3D, from player feet + 0.8 m to shade centre
  night1_duration_s: 240,
  night2_duration_s: 270,
  night3_duration_s: 300,
  flames: 3,
  invuln_s: 1.5, // 90 ticks
  hit_drop_ratio: 0.5, // floor(carried / 2) dropped around the player
  pulse_stun_s: 2, // 120 ticks
  pulse_push_m: 4, // over the first 15 ticks of the stun
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4.0, // Night 3: WORLD.shade_speed_night3
  shade_hit_radius: 1.0,
  dash_speed: 14,
  dash_duration_s: 0.2, // 12 ticks
  dash_cooldown_s: 1.5, // 90 ticks, counted from the start of the dash
  fall_enabled: true, // Y < -10 -> lose a flame and all carried fireflies
  score: Object.freeze({
    per_mote: 5, // per firefly put into a lantern (lighting, relighting or refuelling)
    per_lantern: 100, // first lighting
    per_relight: 40,
    per_stun: 5, // per shade hit by a pulse (each shade, each pulse)
    per_stun_drain: 15, // instead of per_stun when the shade was draining
    per_lit_at_dawn: 50, // on win, per lantern lit at dawn (+ floor(fuel))
    per_second_left: 0, // Ticket-03: time bonus removed
    per_flame_left: 50, // on win: flames * this
  }),
});

// Internal constants from Ticket-02 that are not keys of the contract tuning block.
export const WORLD = Object.freeze({
  tick_rate: 60,
  gravity: 20,
  jump_speed: 7,
  step_height: 0.35, // walkable step (ramps); anything taller is a wall
  fall_y: -10,
  fall_wait_ticks: 60,
  pickup_height: 1.5,
  pulse_center_dy: 0.8,
  pulse_push_ticks: 15,
  mote_cap: 30,
  mote_initial: 20,
  mote_spawn_every_ticks: 240,
  mote_drop_ttl_ticks: 480,
  mote_drop_r_min: 1.5,
  mote_drop_r_max: 2.5,
  shade_first_spawn_tick: 300,
  shade_first_spawn_count: 2,
  shade_speed_night3: 4.5,
  shade_wander_speed: 2,
  shade_wander_radius: 10, // wandering shades roam random points within this radius of their dark lantern
  shade_wander_repick_ticks: 240,
  shade_detect_m: 12,
  shade_lose_m: 18,
  shade_hit_dy: 1.5,
  shade_height: 1, // shade centre above the ground under it
  shade_spawn_min_player_m: 15,
  shade_spawning_ticks: 60, // assumption: 1 s rise-from-the-mist, harmless and still
  shade_recoil_m: 2,
  shade_recoil_ticks: 60,
  safe_evict_ticks: 30,
  drain_range_m: 2, // a wandering shade this close to a weak lantern starts draining it
  drain_chase_m: 6, // a draining shade chases Mây when she comes this close
  drain_event_every_ticks: 60,
  drifter_speed: 7,
  drifter_idle_speed: 2,
  drifter_max: 2,
  drifter_spawn_every_ticks: 1200,
  drifter_chase_carried: 5,
  drifter_chase_m: 15,
  drifter_steal_r: 1.2,
  drifter_steal_max: 3,
  drifter_flee_ticks: 240,
  drifter_drop_vanish_ticks: 120,
  drifter_height: 1.5,
  charm_ticks: 600,
  charm_respawn_ticks: 2700,
  charm_speed: 7.2,
  wind_every_ticks: 1800,
  wind_duration_ticks: 300,
  wind_warn_ticks: 120,
  wind_speed: 2,
});
