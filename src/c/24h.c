#include <pebble.h>

// ---- Persistent storage & AppMessage keys -----------------------------------
#define PKEY_SUNRISE     1
#define PKEY_SUNSET      2
#define PKEY_USE_12H     3
#define PKEY_SHOW_TIDES  5
#define PKEY_TIDE_0      6
#define PKEY_TIDE_1      7
#define PKEY_TIDE_2      8
#define KEY_SUNRISE      0
#define KEY_SUNSET       1
#define KEY_USE_12H      2
#define KEY_SHOW_TIDES   3
#define KEY_TIDE_0       4
#define KEY_TIDE_1       5
#define KEY_TIDE_2       6

#define DEFAULT_SUNRISE_MIN  330    // 5:30 AM
#define DEFAULT_SUNSET_MIN   1155   // 7:15 PM
#define MAX_TIDE_WIDTH       18

// Packed tide test defaults: 8 hours per int32, 4 bits each (0-15)
// Set non-zero values here for emulator testing, reset to 0 before shipping
#define DEFAULT_TIDE_0       0
#define DEFAULT_TIDE_1       0
#define DEFAULT_TIDE_2       0

static Window   *s_window;
static Layer    *s_canvas_layer;
static int32_t   s_sunrise_min   = DEFAULT_SUNRISE_MIN;
static int32_t   s_sunset_min    = DEFAULT_SUNSET_MIN;
static int32_t   s_sunrise_angle = 0;
static int32_t   s_sunset_angle  = 0;
static bool      s_use_12h       = true;
static bool      s_show_tides    = true;
static uint8_t   s_tide_heights[24];  // 0-15 per hour, populated from packed defaults or AppMessage

// ---- Tide data packing (8 values per int32, 4 bits each) --------------------
static void unpack_tides(uint32_t packed, int offset) {
  for (int i = 0; i < 8; i++) {
    s_tide_heights[offset + i] = (packed >> (i * 4)) & 0xF;
  }
}

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
  int    radius     = w / 2;
  int    ring_width = 38;

  int32_t sunrise_angle = s_sunrise_angle;
  int32_t sunset_angle  = s_sunset_angle;

  time_t     now   = time(NULL);
  struct tm *local = localtime(&now);

  // White interior
  graphics_context_set_fill_color(ctx, GColorWhite);
  graphics_fill_radial(ctx, bounds, GOvalScaleModeFitCircle, radius, 0, TRIG_MAX_ANGLE);

  // Night arc — outer ring only
  graphics_context_set_fill_color(ctx, GColorBlack);
  if (sunset_angle <= sunrise_angle) {
    graphics_fill_radial(ctx, bounds, GOvalScaleModeFitCircle, ring_width, sunset_angle, sunrise_angle);
  } else {
    graphics_fill_radial(ctx, bounds, GOvalScaleModeFitCircle, ring_width, sunset_angle, TRIG_MAX_ANGLE);
    graphics_fill_radial(ctx, bounds, GOvalScaleModeFitCircle, ring_width, 0, sunrise_angle);
  }


  // Numerals — outer edge
  GFont num_font = fonts_get_system_font(FONT_KEY_GOTHIC_14);

  for (int i = 0; i < 24; i++) {
    int32_t angle = hour_to_angle(i);
    int     nr    = radius - 8;

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
    GRect text_rect = GRect(pos.x - 10, pos.y - 8, 20, 16);

    graphics_context_set_text_color(ctx, outline);
    for (int dx = -1; dx <= 1; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        if (dx == 0 && dy == 0) continue;
        GRect r = GRect(text_rect.origin.x + dx, text_rect.origin.y + dy,
                        text_rect.size.w, text_rect.size.h);
        graphics_draw_text(ctx, num_str, num_font, r,
                           GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
      }
    }
    graphics_context_set_text_color(ctx, fg);
    graphics_draw_text(ctx, num_str, num_font, text_rect,
                       GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
  }

  // Tick marks — inside numerals, every 15 minutes (96 ticks for 24h)
  int tick_base = radius - 18;
  for (int i = 0; i < 96; i++) {
    int32_t angle = (int32_t)((int64_t)TRIG_MAX_ANGLE * ((i * 15 + 12 * 60) % (24 * 60)) / (24 * 60));
    bool on_hour    = (i % 4 == 0);
    bool on_half    = (i % 2 == 0);
    int  tick_len   = on_hour ? 14 : on_half ? 10 : 5;
    int  r_outer    = tick_base;
    int  r_inner    = tick_base - tick_len;

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
    graphics_context_set_stroke_width(ctx, 1);
    graphics_draw_line(ctx, outer, inner);
  }

  // Tide overlay — variable-width per-hour bars inside the tick marks
  int tide_inset = radius - tick_base + 14;
  GRect tide_bounds = grect_inset(bounds, GEdgeInsets(tide_inset));
  if (s_show_tides) {
    for (int th = 0; th < 24; th++) {
      if (s_tide_heights[th] == 0) continue;
      int bar_width = 1 + (s_tide_heights[th] * (MAX_TIDE_WIDTH - 1)) / 15;
      int32_t a0 = hour_to_angle(th);
      int32_t a1 = hour_to_angle(th + 1);
      bool is_day = angle_in_arc(hour_to_angle(th), sunrise_angle, sunset_angle);
      graphics_context_set_fill_color(ctx, is_day ? GColorPictonBlue : GColorOxfordBlue);
      if (a0 <= a1) {
        graphics_fill_radial(ctx, tide_bounds, GOvalScaleModeFitCircle, bar_width, a0, a1);
      } else {
        graphics_fill_radial(ctx, tide_bounds, GOvalScaleModeFitCircle, bar_width, a0, TRIG_MAX_ANGLE);
        graphics_fill_radial(ctx, tide_bounds, GOvalScaleModeFitCircle, bar_width, 0, a1);
      }
    }
  }

  // AM / PM labels
  GFont label_font = fonts_get_system_font(FONT_KEY_GOTHIC_14);
  int label_y = center.y - 7;
  int label_offset = (radius - ring_width) * 2 / 3;

  GRect am_rect = GRect(center.x - label_offset - 12, label_y, 24, 16);
  GRect pm_rect = GRect(center.x + label_offset - 12, label_y, 24, 16);

  int32_t left_angle  = TRIG_MAX_ANGLE * 3 / 4;
  int32_t right_angle = TRIG_MAX_ANGLE / 4;
  bool left_day  = angle_in_arc(left_angle, sunrise_angle, sunset_angle);
  bool right_day = angle_in_arc(right_angle, sunrise_angle, sunset_angle);

  graphics_context_set_text_color(ctx, left_day ? GColorDarkGray : GColorLightGray);
  graphics_draw_text(ctx, "AM", label_font, am_rect,
                     GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
  graphics_context_set_text_color(ctx, right_day ? GColorDarkGray : GColorLightGray);
  graphics_draw_text(ctx, "PM", label_font, pm_rect,
                     GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);

  // Hand — tapered from base to pointed tip
  int32_t hand_angle = minutes_to_angle(local->tm_hour * 60 + local->tm_min);
  int     hand_len   = tick_base;
  int     tail_len   = 15;
  int     base_half  = 4;

  int32_t perp_angle = hand_angle + TRIG_MAX_ANGLE / 4;
  int32_t sin_h = sin_lookup(hand_angle);
  int32_t cos_h = cos_lookup(hand_angle);
  int32_t sin_p = sin_lookup(perp_angle);
  int32_t cos_p = cos_lookup(perp_angle);

  GPoint tip = GPoint(
    center.x + (hand_len * sin_h) / TRIG_MAX_RATIO,
    center.y - (hand_len * cos_h) / TRIG_MAX_RATIO
  );
  GPoint base_l = GPoint(
    center.x + (base_half * sin_p) / TRIG_MAX_RATIO,
    center.y - (base_half * cos_p) / TRIG_MAX_RATIO
  );
  GPoint base_r = GPoint(
    center.x - (base_half * sin_p) / TRIG_MAX_RATIO,
    center.y + (base_half * cos_p) / TRIG_MAX_RATIO
  );
  GPoint tail = GPoint(
    center.x - (tail_len * sin_h) / TRIG_MAX_RATIO,
    center.y + (tail_len * cos_h) / TRIG_MAX_RATIO
  );

  GPoint hand_pts[] = { tip, base_l, tail, base_r };
  GPath *hand_path = gpath_create(&(GPathInfo){
    .num_points = 4, .points = hand_pts
  });
  graphics_context_set_fill_color(ctx, GColorBlack);
  gpath_draw_filled(ctx, hand_path);
  gpath_destroy(hand_path);

  graphics_context_set_stroke_color(ctx, GColorBlack);
  graphics_context_set_stroke_width(ctx, 1);
  graphics_draw_line(ctx, center, tip);

  graphics_fill_circle(ctx, center, 5);
}

// ---- AppMessage -------------------------------------------------------------
static void inbox_received(DictionaryIterator *iter, void *context) {
  Tuple *sr_t = dict_find(iter, KEY_SUNRISE);
  Tuple *ss_t = dict_find(iter, KEY_SUNSET);
  if (sr_t) { s_sunrise_min = sr_t->value->int32; persist_write_int(PKEY_SUNRISE, s_sunrise_min); }
  if (ss_t) { s_sunset_min  = ss_t->value->int32; persist_write_int(PKEY_SUNSET,  s_sunset_min); }

  Tuple *mode_t = dict_find(iter, KEY_USE_12H);
  if (mode_t) { s_use_12h = (mode_t->value->int32 != 0); persist_write_bool(PKEY_USE_12H, s_use_12h); }

  Tuple *show_tides_t = dict_find(iter, KEY_SHOW_TIDES);
  if (show_tides_t) { s_show_tides = (show_tides_t->value->int32 != 0); persist_write_bool(PKEY_SHOW_TIDES, s_show_tides); }

  Tuple *t0 = dict_find(iter, KEY_TIDE_0);
  Tuple *t1 = dict_find(iter, KEY_TIDE_1);
  Tuple *t2 = dict_find(iter, KEY_TIDE_2);
  if (t0) { unpack_tides((uint32_t)t0->value->int32, 0);  persist_write_int(PKEY_TIDE_0, t0->value->int32); }
  if (t1) { unpack_tides((uint32_t)t1->value->int32, 8);  persist_write_int(PKEY_TIDE_1, t1->value->int32); }
  if (t2) { unpack_tides((uint32_t)t2->value->int32, 16); persist_write_int(PKEY_TIDE_2, t2->value->int32); }

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
  // Load compile-time defaults (useful for emulator testing)
  unpack_tides(DEFAULT_TIDE_0, 0);
  unpack_tides(DEFAULT_TIDE_1, 8);
  unpack_tides(DEFAULT_TIDE_2, 16);

  if (persist_exists(PKEY_SUNRISE))    s_sunrise_min  = persist_read_int(PKEY_SUNRISE);
  if (persist_exists(PKEY_SUNSET))     s_sunset_min   = persist_read_int(PKEY_SUNSET);
  if (persist_exists(PKEY_USE_12H))    s_use_12h      = persist_read_bool(PKEY_USE_12H);
  if (persist_exists(PKEY_SHOW_TIDES)) s_show_tides   = persist_read_bool(PKEY_SHOW_TIDES);
  if (persist_exists(PKEY_TIDE_0))     unpack_tides((uint32_t)persist_read_int(PKEY_TIDE_0), 0);
  if (persist_exists(PKEY_TIDE_1))     unpack_tides((uint32_t)persist_read_int(PKEY_TIDE_1), 8);
  if (persist_exists(PKEY_TIDE_2))     unpack_tides((uint32_t)persist_read_int(PKEY_TIDE_2), 16);

  s_window = window_create();
  window_set_window_handlers(s_window, (WindowHandlers) {
    .load   = prv_window_load,
    .unload = prv_window_unload,
  });
  window_stack_push(s_window, true);

  update_sun_angles();

  tick_timer_service_subscribe(MINUTE_UNIT, tick_handler);
  app_message_open(256, 128);
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
