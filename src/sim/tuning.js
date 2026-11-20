// Single source of truth for gameplay numbers. game.contract.json "tuning" must match
// TUNING exactly (enforced by tests/contract.test.js).
export const TUNING = Object.freeze({
  player_speed: 6, // m/s on the XZ plane
  carry_capacity: 5, // max fireflies carried
  lantern_cost: 5, // fireflies needed to light one lantern
  lantern_count_night1: 5,
  pickup_radius: 1.5, // m, player feet -> mote ground point
  interact_radius: 2.5, // m, player feet -> lantern base
  pulse_cost: 1, // carried fireflies consumed per pulse
  pulse_radius: 6, // m, player -> shade center
  night1_duration_s: 300,
  flames: 3, // player health
  invuln_s: 1.5, // seconds of invulnerability after a hit
  hit_drop_ratio: 0.5, // dropped = floor(carried * ratio); dropped fireflies are lost
  pulse_stun_s: 2,
  pulse_push_m: 4, // shades in pulse radius are pushed this far directly away from player
  pulse_cooldown_s: 1,
  safe_radius: 4, // m around a LIT lantern that shades cannot enter
  shade_speed: 3.5, // m/s
  shade_hit_radius: 1, // m, shade center -> player feet (XZ)
  fall_enabled: false, // island edge is a soft wall; no falling
  score: Object.freeze({
    per_mote: 10, // on pickup
    per_lantern: 100, // when a lantern becomes lit
    per_stun: 20, // per shade stunned by a pulse
    per_second_left: 2, // on win: floor(time_left_s) * this
    per_flame_left: 50, // on win: flames * this
  }),
});

// Internal constants that are not part of the contract tuning block.
export const WORLD = Object.freeze({
  tick_rate: 60,
  island_radius: 40, // player is clamped inside this radius (XZ)
  shade_bound_radius: 44, // shades are clamped inside this radius
  lantern_ring_radius: 24, // default lantern placement
  mote_target: 20, // active fireflies kept on the island when random_motes = true
  mote_respawn_s: 2, // delay before a missing firefly respawns
  mote_min_r: 3,
  mote_max_r: 38,
  shade_initial: 2, // shades built with the level when random_shades = true (no event)
  shade_max: 5,
  shade_spawn_first_s: 20, // first extra shade spawns at this time, then every interval
  shade_spawn_every_s: 30,
  shade_spawn_min_r: 30,
  shade_spawn_max_r: 38,
  shade_spawn_min_player_dist: 15,
  shade_height: 1, // shade center Y
  jump_speed: 7, // m/s
  gravity: 20, // m/s^2
});
