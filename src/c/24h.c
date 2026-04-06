#include <pebble.h>

// ---- Persistent storage & AppMessage keys -----------------------------------
#define PKEY_SUNRISE   1
#define PKEY_SUNSET    2
#define PKEY_USE_12H   3
#define KEY_SUNRISE    0
#define KEY_SUNSET     1
#define KEY_USE_12H    2

#define DEFAULT_SUNRISE_MIN  392   // 6:32 AM (NYC)
#define DEFAULT_SUNSET_MIN  1164  // 7:24 PM (NYC)

static Window  *s_window;
static Layer   *s_canvas_layer;
static int32_t  s_sunrise_min   = DEFAULT_SUNRISE_MIN;
static int32_t  s_sunset_min    = DEFAULT_SUNSET_MIN;
static int32_t  s_sunrise_angle = 0;
static int32_t  s_sunset_angle  = 0;
static bool     s_use_12h       = false;

// ---- Angle helpers ----------------------------------------------------------
// Noon (12:00 local) = top = 0; Midnight = bottom = TRIG_MAX_ANGLE/2
static int32_t minutes_to_angle(int local_min) {
  int adj = (local_min + 12 * 60) % (24 * 60);
  return (int32_t)((int64_t)TRIG_MAX_ANGLE * adj / (24 * 60));
}

static int32_t hour_to_angle(int h) {
  return (int32_t)((int64_t)TRIG_MAX_ANGLE * ((h + 12) % 24) / 24);
}

static bool angle_in_arc(int32_t angle, int32_t start, int32_t end) {
  angle = ((angle % TRIG_MAX_ANGLE) + TRIG_MAX_ANGLE) % TRIG_MAX_ANGLE;
  start = ((start % TRIG_MAX_ANGLE) + TRIG_MAX_ANGLE) % TRIG_MAX_ANGLE;
  end   = ((end   % TRIG_MAX_ANGLE) + TRIG_MAX_ANGLE) % TRIG_MAX_ANGLE;
  return (start <= end)
    ? (angle >= start && angle <= end)
    : (angle >= start || angle <= end);
}

static void update_sun_angles(void) {
  s_sunrise_angle = minutes_to_angle(s_sunrise_min);
  s_sunset_angle  = minutes_to_angle(s_sunset_min);
}

// ---- Drawing ----------------------------------------------------------------
static void canvas_update_proc(Layer *layer, GContext *ctx) {
  GRect  bounds = layer_get_bounds(layer);
  int    w      = bounds.size.w;
  int    h      = bounds.size.h;
  GPoint center = GPoint(w / 2, h / 2);
  int    radius = w / 2;

  int32_t sunrise_angle = s_sunrise_angle;
  int32_t sunset_angle  = s_sunset_angle;

  time_t     now   = time(NULL);
  struct tm *local = localtime(&now);

  // Background: full white (day), then paint the night arc black.
  graphics_context_set_fill_color(ctx, GColorWhite);
  graphics_fill_radial(ctx, bounds, GOvalScaleModeFitCircle, radius, 0, TRIG_MAX_ANGLE);

  graphics_context_set_fill_color(ctx, GColorBlack);
  if (sunset_angle <= sunrise_angle) {
    graphics_fill_radial(ctx, bounds, GOvalScaleModeFitCircle, radius, sunset_angle, sunrise_angle);
  } else {
    graphics_fill_radial(ctx, bounds, GOvalScaleModeFitCircle, radius, sunset_angle, TRIG_MAX_ANGLE);
    graphics_fill_radial(ctx, bounds, GOvalScaleModeFitCircle, radius, 0, sunrise_angle);
  }

  // 24 tick marks
  for (int i = 0; i < 24; i++) {
    int32_t angle    = hour_to_angle(i);
    int     tick_len = (i % 6 == 0) ? 12 : (i % 3 == 0) ? 8 : 5;
    int     r_outer  = radius - 1;
    int     r_inner  = r_outer - tick_len;

    GPoint outer = GPoint(
      center.x + (r_outer * sin_lookup(angle)) / TRIG_MAX_RATIO,
      center.y - (r_outer * cos_lookup(angle)) / TRIG_MAX_RATIO
    );
    GPoint inner = GPoint(
      center.x + (r_inner * sin_lookup(angle)) / TRIG_MAX_RATIO,
      center.y - (r_inner * cos_lookup(angle)) / TRIG_MAX_RATIO
    );

    bool is_day = angle_in_arc(angle, sunrise_angle, sunset_angle);
    graphics_context_set_stroke_color(ctx, is_day ? GColorBlack : GColorWhite);
    graphics_context_set_stroke_width(ctx, (i % 6 == 0) ? 2 : 1);
    graphics_draw_line(ctx, outer, inner);
  }

  // Numerals
  GFont font_major = fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD);
  GFont font_minor = fonts_get_system_font(FONT_KEY_FONT_FALLBACK);

  for (int i = 0; i < 24; i++) {
    int32_t angle    = hour_to_angle(i);
    bool    is_major = (i % 6 == 0);
    int     nr       = radius - (is_major ? 22 : 19);

    GPoint pos = GPoint(
      center.x + (nr * sin_lookup(angle)) / TRIG_MAX_RATIO,
      center.y - (nr * cos_lookup(angle)) / TRIG_MAX_RATIO
    );

    bool is_day = angle_in_arc(angle, sunrise_angle, sunset_angle);
    GColor fg      = is_day ? GColorBlack : GColorWhite;
    GColor outline = is_day ? GColorWhite : GColorBlack;

    int display_h = s_use_12h ? (i % 12 == 0 ? 12 : i % 12) : i;
    char num_str[4];
    snprintf(num_str, sizeof(num_str), "%d", display_h);
    GFont font = is_major ? font_major : font_minor;
    GRect text_rect = GRect(pos.x - 11, pos.y - 9, 22, 16);

    graphics_context_set_text_color(ctx, outline);
    for (int dx = -1; dx <= 1; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        if (dx == 0 && dy == 0) continue;
        GRect r = GRect(text_rect.origin.x + dx, text_rect.origin.y + dy,
                        text_rect.size.w, text_rect.size.h);
        graphics_draw_text(ctx, num_str, font, r,
                           GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
      }
    }
    graphics_context_set_text_color(ctx, fg);
    graphics_draw_text(ctx, num_str, font, text_rect,
                       GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
  }

  // Single 24h hand — thin line from center to edge
  int32_t hand_angle = minutes_to_angle(local->tm_hour * 60 + local->tm_min);
  int     hand_len   = radius - 1;
  int     tail_len   = 12;

  GPoint hand_tip = GPoint(
    center.x + (hand_len * sin_lookup(hand_angle)) / TRIG_MAX_RATIO,
    center.y - (hand_len * cos_lookup(hand_angle)) / TRIG_MAX_RATIO
  );
  GPoint hand_tail = GPoint(
    center.x - (tail_len * sin_lookup(hand_angle)) / TRIG_MAX_RATIO,
    center.y + (tail_len * cos_lookup(hand_angle)) / TRIG_MAX_RATIO
  );

  graphics_context_set_stroke_color(ctx, GColorRed);
  graphics_context_set_stroke_width(ctx, 1);
  graphics_draw_line(ctx, hand_tail, hand_tip);

  graphics_context_set_fill_color(ctx, GColorRed);
  graphics_fill_circle(ctx, center, 3);
}

// ---- AppMessage -------------------------------------------------------------
static void inbox_received(DictionaryIterator *iter, void *context) {
  Tuple *sr_t = dict_find(iter, KEY_SUNRISE);
  Tuple *ss_t = dict_find(iter, KEY_SUNSET);
  if (sr_t) { s_sunrise_min = sr_t->value->int32; persist_write_int(PKEY_SUNRISE, s_sunrise_min); }
  if (ss_t) { s_sunset_min  = ss_t->value->int32; persist_write_int(PKEY_SUNSET,  s_sunset_min); }

  Tuple *mode_t = dict_find(iter, KEY_USE_12H);
  if (mode_t) { s_use_12h = (mode_t->value->int32 != 0); persist_write_bool(PKEY_USE_12H, s_use_12h); }

  if (sr_t || ss_t) update_sun_angles();
  layer_mark_dirty(s_canvas_layer);
}

// ---- Tick -------------------------------------------------------------------
static void tick_handler(struct tm *tick_time, TimeUnits units_changed) {
  layer_mark_dirty(s_canvas_layer);
}

// ---- Window -----------------------------------------------------------------
static void prv_window_load(Window *window) {
  Layer *root   = window_get_root_layer(window);
  GRect  bounds = layer_get_bounds(root);
  s_canvas_layer = layer_create(bounds);
  layer_set_update_proc(s_canvas_layer, canvas_update_proc);
  layer_add_child(root, s_canvas_layer);
}

static void prv_window_unload(Window *window) {
  layer_destroy(s_canvas_layer);
}

// ---- Init -------------------------------------------------------------------
static void prv_init(void) {
  if (persist_exists(PKEY_SUNRISE)) s_sunrise_min = persist_read_int(PKEY_SUNRISE);
  if (persist_exists(PKEY_SUNSET))  s_sunset_min  = persist_read_int(PKEY_SUNSET);
  if (persist_exists(PKEY_USE_12H)) s_use_12h     = persist_read_bool(PKEY_USE_12H);

  s_window = window_create();
  window_set_window_handlers(s_window, (WindowHandlers) {
    .load   = prv_window_load,
    .unload = prv_window_unload,
  });
  window_stack_push(s_window, true);

  update_sun_angles();

  tick_timer_service_subscribe(MINUTE_UNIT, tick_handler);
  app_message_open(128, 128);
  app_message_register_inbox_received(inbox_received);
}

static void prv_deinit(void) {
  tick_timer_service_unsubscribe();
  window_destroy(s_window);
}

int main(void) {
  prv_init();
  app_event_loop();
  prv_deinit();
}
