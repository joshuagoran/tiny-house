#!/usr/bin/env python3
"""Generate to-scale SVG floor plans for tiny house on trailer.

All dimensions in inches. Parameterized at the top for easy iteration.
Produces three plan views: main floor, loft, porch.
Output is a clean, styled SVG viewable in any browser.
"""

import os
import math

# ── Parameters ───────────────────────────────────────────────────────────────

# Trailer / shell
TRAILER_LENGTH = 28 * 12       # 336" (change to 26*12 = 312 for shorter option)
TRAILER_WIDTH = 8.5 * 12       # 102"
WALL_THICKNESS = 3.5            # 2x4 walls (change to 5.5 for 2x6)

# Zone lengths (must sum to TRAILER_LENGTH)
BATH_LENGTH = 6 * 12            # 72"
KITCHEN_LENGTH = 10 * 12        # 120"
LIVING_LENGTH = 12 * 12         # 144"

# Loft
LOFT_LENGTH = 10 * 12           # 120" (8' over bath + 2' into kitchen)

# Porch
PORCH_LENGTH = TRAILER_LENGTH
PORCH_WIDTH = 8 * 12            # 96"

# Fixture dimensions (width × depth in inches)
SHOWER_W, SHOWER_D = 36, 32
TOILET_W, TOILET_D = 18, 28
VANITY_W, VANITY_D = 24, 20
WATER_HEATER = 18
FRIDGE_W, FRIDGE_D = 24, 24
WD_W, WD_D = 24, 24
COOKTOP_W, COOKTOP_D = 12, 20
DISHDRAWER_W, DISHDRAWER_D = 24, 24
SINK_W, SINK_D = 24, 18
WOODSTOVE = 16
KING_BED_L, KING_BED_W = 80, 76
COFFEE_TABLE_L, COFFEE_TABLE_W = 48, 24
DESK_L, DESK_W = 48, 24
LEDGE_WIDTH = 11
COUNTER_DEPTH = 24

POCKET_DOOR_W = 30
ENTRY_DOOR_W = 32
WINDOW_SMALL = 30

# Display scale: 1 inch = 2 SVG units (px)
SCALE = 2.0
PADDING = 60
VIEW_GAP = 80

# ── Colors ───────────────────────────────────────────────────────────────────

COLORS = {
    "bg": "#faf8f5",
    "walls": "#2C2A25",
    "walls_interior": "#6B6860",
    "zone_bath": "#EDEAF4",
    "zone_kitchen": "#E8F0E9",
    "zone_living": "#E4EDF3",
    "fixtures": "#7B6FA0",
    "appliances": "#5B7A5E",
    "furniture": "#B8923E",
    "stairs": "#C4956A",
    "windows": "#3B8BD4",
    "doors": "#5A7C96",
    "porch": "#D8D4CB",
    "porch_fill": "#F5F3EF",
    "text": "#2C2A25",
    "text_muted": "#9C9889",
    "dim": "#9C9889",
    "loft_fill": "#F9F7F4",
}


# ── SVG Builder ──────────────────────────────────────────────────────────────

class SVGBuilder:
    def __init__(self):
        self.elements = []
        self.defs = []
        self._id_counter = 0

    def _s(self, v):
        """Scale inches to SVG units."""
        return v * SCALE

    def _uid(self, prefix="el"):
        self._id_counter += 1
        return f"{prefix}-{self._id_counter}"

    def rect(self, x, y, w, h, fill="none", stroke="#000", stroke_width=1,
             rx=0, opacity=1, dash=None, css_class=None, data_zone=None):
        attrs = (
            f'x="{self._s(x):.1f}" y="{self._s(y):.1f}" '
            f'width="{self._s(w):.1f}" height="{self._s(h):.1f}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{stroke_width}" '
            f'rx="{rx}" opacity="{opacity}"'
        )
        if dash:
            attrs += f' stroke-dasharray="{dash}"'
        if css_class:
            attrs += f' class="{css_class}"'
        if data_zone:
            attrs += f' data-zone="{data_zone}"'
        self.elements.append(f"<rect {attrs}/>")

    def line(self, x1, y1, x2, y2, stroke="#000", stroke_width=1, dash=None):
        attrs = (
            f'x1="{self._s(x1):.1f}" y1="{self._s(y1):.1f}" '
            f'x2="{self._s(x2):.1f}" y2="{self._s(y2):.1f}" '
            f'stroke="{stroke}" stroke-width="{stroke_width}"'
        )
        if dash:
            attrs += f' stroke-dasharray="{dash}"'
        self.elements.append(f"<line {attrs}/>")

    def circle(self, cx, cy, r, fill="none", stroke="#000", stroke_width=1):
        self.elements.append(
            f'<circle cx="{self._s(cx):.1f}" cy="{self._s(cy):.1f}" '
            f'r="{self._s(r):.1f}" fill="{fill}" stroke="{stroke}" '
            f'stroke-width="{stroke_width}"/>'
        )

    def text(self, x, y, label, size=11, color="#000", weight="500",
             anchor="middle", font="system-ui, sans-serif"):
        lines = label.split("\n")
        if len(lines) == 1:
            self.elements.append(
                f'<text x="{self._s(x):.1f}" y="{self._s(y):.1f}" '
                f'font-family="{font}" font-size="{size}" font-weight="{weight}" '
                f'fill="{color}" text-anchor="{anchor}" '
                f'dominant-baseline="central">{label}</text>'
            )
        else:
            # Multiline: use tspan
            start_y = self._s(y) - (len(lines) - 1) * (size * 0.6)
            parts = [
                f'<text x="{self._s(x):.1f}" y="{start_y:.1f}" '
                f'font-family="{font}" font-size="{size}" font-weight="{weight}" '
                f'fill="{color}" text-anchor="{anchor}">'
            ]
            for i, line in enumerate(lines):
                dy = 0 if i == 0 else size * 1.2
                parts.append(
                    f'<tspan x="{self._s(x):.1f}" dy="{dy}">{line}</tspan>'
                )
            parts.append("</text>")
            self.elements.append("".join(parts))

    def group_start(self, id=None, css_class=None, transform=None):
        attrs = ""
        if id:
            attrs += f' id="{id}"'
        if css_class:
            attrs += f' class="{css_class}"'
        if transform:
            attrs += f' transform="{transform}"'
        self.elements.append(f"<g{attrs}>")

    def group_end(self):
        self.elements.append("</g>")

    def comment(self, text):
        self.elements.append(f"<!-- {text} -->")

    def arc(self, cx, cy, r, start_deg, end_deg, stroke="#000", stroke_width=1):
        """Draw an arc (for door swings)."""
        sr = math.radians(start_deg)
        er = math.radians(end_deg)
        x1 = self._s(cx) + self._s(r) * math.cos(sr)
        y1 = self._s(cy) + self._s(r) * math.sin(sr)
        x2 = self._s(cx) + self._s(r) * math.cos(er)
        y2 = self._s(cy) + self._s(r) * math.sin(er)
        large = 1 if abs(end_deg - start_deg) > 180 else 0
        self.elements.append(
            f'<path d="M {x1:.1f} {y1:.1f} A {self._s(r):.1f} {self._s(r):.1f} '
            f'0 {large} 1 {x2:.1f} {y2:.1f}" '
            f'fill="none" stroke="{stroke}" stroke-width="{stroke_width}" '
            f'stroke-dasharray="4 3"/>'
        )

    def dim_horizontal(self, x1, x2, y, label, offset=12):
        """Dimension line with label."""
        dy = self._s(y + offset)
        sx1, sx2 = self._s(x1), self._s(x2)
        # Extension lines
        self.elements.append(
            f'<line x1="{sx1}" y1="{self._s(y)}" x2="{sx1}" y2="{dy}" '
            f'stroke="{COLORS["dim"]}" stroke-width="0.5"/>'
        )
        self.elements.append(
            f'<line x1="{sx2}" y1="{self._s(y)}" x2="{sx2}" y2="{dy}" '
            f'stroke="{COLORS["dim"]}" stroke-width="0.5"/>'
        )
        # Dimension line
        self.elements.append(
            f'<line x1="{sx1}" y1="{dy}" x2="{sx2}" y2="{dy}" '
            f'stroke="{COLORS["dim"]}" stroke-width="0.8" '
            f'marker-start="url(#dim-tick)" marker-end="url(#dim-tick)"/>'
        )
        # Label
        mid = (sx1 + sx2) / 2
        self.elements.append(
            f'<text x="{mid}" y="{dy - 4}" font-family="system-ui, sans-serif" '
            f'font-size="10" fill="{COLORS["dim"]}" text-anchor="middle">{label}</text>'
        )

    def dim_vertical(self, y1, y2, x, label, offset=-12):
        """Vertical dimension line with label."""
        dx = self._s(x + offset)
        sy1, sy2 = self._s(y1), self._s(y2)
        self.elements.append(
            f'<line x1="{self._s(x)}" y1="{sy1}" x2="{dx}" y2="{sy1}" '
            f'stroke="{COLORS["dim"]}" stroke-width="0.5"/>'
        )
        self.elements.append(
            f'<line x1="{self._s(x)}" y1="{sy2}" x2="{dx}" y2="{sy2}" '
            f'stroke="{COLORS["dim"]}" stroke-width="0.5"/>'
        )
        self.elements.append(
            f'<line x1="{dx}" y1="{sy1}" x2="{dx}" y2="{sy2}" '
            f'stroke="{COLORS["dim"]}" stroke-width="0.8" '
            f'marker-start="url(#dim-tick)" marker-end="url(#dim-tick)"/>'
        )
        mid = (sy1 + sy2) / 2
        self.elements.append(
            f'<text x="{dx - 4}" y="{mid}" font-family="system-ui, sans-serif" '
            f'font-size="10" fill="{COLORS["dim"]}" text-anchor="middle" '
            f'transform="rotate(-90 {dx - 4} {mid})">{label}</text>'
        )

    def fixture_rect(self, x, y, w, h, label, fill, stroke, text_color=None):
        """Labeled fixture rectangle."""
        if text_color is None:
            text_color = stroke
        self.rect(x, y, w, h, fill=fill, stroke=stroke, stroke_width=0.5, rx=2)
        self.text(x + w / 2, y + h / 2, label, size=8, color=text_color, weight="500")

    def window(self, x, y, w, h, vertical=False):
        """Window symbol — thick colored line."""
        if vertical:
            self.rect(x, y, 3, h, fill=COLORS["windows"], stroke="none", rx=1, opacity=0.7)
        else:
            self.rect(x, y, w, 3, fill=COLORS["windows"], stroke="none", rx=1, opacity=0.7)

    def render(self, total_width, total_height):
        w = total_width + PADDING * 2
        h = total_height + PADDING * 2
        svg_parts = [
            f'<?xml version="1.0" encoding="UTF-8"?>',
            f'<svg viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" '
            f'xmlns="http://www.w3.org/2000/svg">',
            f'<defs>',
            f'  <marker id="dim-tick" viewBox="0 0 6 6" refX="3" refY="3" '
            f'markerWidth="6" markerHeight="6" orient="auto">',
            f'    <line x1="3" y1="0" x2="3" y2="6" stroke="{COLORS["dim"]}" stroke-width="1"/>',
            f'  </marker>',
            # Tooltip style
            f'  <style>',
            f'    .zone-hover {{ cursor: pointer; transition: opacity 0.15s; }}',
            f'    .zone-hover:hover {{ opacity: 0.7; }}',
            f'    .section-title {{ font-family: Georgia, serif; }}',
            f'  </style>',
            f'</defs>',
            f'<rect width="{w}" height="{h}" fill="{COLORS["bg"]}"/>',
            f'<g transform="translate({PADDING}, {PADDING})">',
        ]
        svg_parts.extend(self.elements)
        svg_parts.append("</g>")
        svg_parts.append("</svg>")
        return "\n".join(svg_parts)


# ── Drawing functions ────────────────────────────────────────────────────────

def draw_main_floor(svg, ox, oy):
    """Draw main floor plan. Returns bottom y coordinate.

    Orientation: top = interior wall (stairs), bottom = porch side (entry, windows).
    Left = bathroom gable end, right = living gable end.
    """
    L, W = TRAILER_LENGTH, TRAILER_WIDTH
    EW = WALL_THICKNESS

    bath_end = ox + BATH_LENGTH
    kitchen_end = bath_end + KITCHEN_LENGTH

    # Shorthand: top of interior = oy, bottom of interior = oy + W
    # top edge = interior wall, bottom edge = porch side
    porch_y = oy + W  # bottom edge (porch side)

    svg.comment("===== MAIN FLOOR =====")
    svg.group_start(id="main-floor")

    # Title
    svg.text(ox + L / 2, oy - 18, "MAIN FLOOR PLAN", size=14, color=COLORS["text"],
             weight="700", font="Georgia, serif")
    svg.text(ox + L / 2, oy - 8,
             f"{L // 12}'-0\" × {W / 12:.0f}'-{W % 12:.0f}\"",
             size=11, color=COLORS["text_muted"])

    # Side labels
    svg.text(ox + L + 8, oy + 12, "interior wall", size=8, color=COLORS["text_muted"],
             anchor="start")
    svg.text(ox + L + 8, porch_y - 8, "porch side", size=8, color=COLORS["text_muted"],
             anchor="start")

    # Zone fills
    svg.rect(ox + EW, oy + EW, BATH_LENGTH - EW, W - 2 * EW,
             fill=COLORS["zone_bath"], stroke="none", css_class="zone-hover",
             data_zone="bathroom")
    svg.rect(bath_end, oy + EW, KITCHEN_LENGTH, W - 2 * EW,
             fill=COLORS["zone_kitchen"], stroke="none", css_class="zone-hover",
             data_zone="kitchen")
    svg.rect(kitchen_end, oy + EW, LIVING_LENGTH - EW, W - 2 * EW,
             fill=COLORS["zone_living"], stroke="none", css_class="zone-hover",
             data_zone="living")

    # Exterior walls
    svg.rect(ox, oy, L, W, fill="none", stroke=COLORS["walls"], stroke_width=3)

    # Bath/kitchen partition
    svg.line(bath_end, oy + EW, bath_end, porch_y - EW,
             stroke=COLORS["walls_interior"], stroke_width=2)

    # Zone labels (centered vertically in each zone)
    svg.text(ox + BATH_LENGTH / 2, oy + W / 2 - 6, "BATHROOM",
             size=13, color=COLORS["fixtures"], weight="600", font="Georgia, serif")
    svg.text(ox + BATH_LENGTH / 2, oy + W / 2 + 6, "~6'",
             size=10, color=COLORS["text_muted"])

    svg.text(bath_end + KITCHEN_LENGTH / 2, oy + W / 2 - 6, "KITCHEN",
             size=13, color=COLORS["appliances"], weight="600", font="Georgia, serif")
    svg.text(bath_end + KITCHEN_LENGTH / 2, oy + W / 2 + 6, "~10'",
             size=10, color=COLORS["text_muted"])

    svg.text(kitchen_end + LIVING_LENGTH / 2, oy + W / 2 - 6, "LIVING",
             size=13, color=COLORS["doors"], weight="600", font="Georgia, serif")
    svg.text(kitchen_end + LIVING_LENGTH / 2, oy + W / 2 + 6, "~12'",
             size=10, color=COLORS["text_muted"])

    # ── BATHROOM ──
    svg.comment("Bathroom fixtures")

    # Shower — gable end + porch side corner (bottom-left)
    shower_x = ox + EW
    shower_y = porch_y - EW - SHOWER_D
    svg.fixture_rect(shower_x, shower_y, SHOWER_W, SHOWER_D, "SHOWER\n32×36",
                     "#E0DCF0", COLORS["fixtures"])
    # Glass panel
    svg.line(shower_x + SHOWER_W, shower_y, shower_x + SHOWER_W, shower_y + SHOWER_D,
             stroke=COLORS["fixtures"], stroke_width=1.5)

    # Vanity — gable end wall (left side, interior half)
    vanity_x = ox + EW
    vanity_y = oy + EW + 6
    svg.fixture_rect(vanity_x, vanity_y, VANITY_D, VANITY_W, "VANITY",
                     "#E0DCF0", COLORS["fixtures"])

    # Toilet — interior wall side (top), under window
    toilet_x = ox + EW + VANITY_D + 8
    toilet_y = oy + EW
    svg.fixture_rect(toilet_x, toilet_y, TOILET_W, TOILET_D, "TOILET",
                     "#E0DCF0", COLORS["fixtures"])
    # Window above toilet (on interior/top wall)
    svg.window(toilet_x - 3, oy, TOILET_W + 6, EW)

    # Water heater — near plumbing wall (interior side)
    wh_x = bath_end - EW - WATER_HEATER - 4
    wh_y = oy + EW
    svg.fixture_rect(wh_x, wh_y, WATER_HEATER, WATER_HEATER, "HW",
                     "#E8F0E9", COLORS["appliances"])

    # Pocket door — centered on dividing wall
    door_cy = oy + W / 2
    svg.rect(bath_end - 1.5, door_cy - POCKET_DOOR_W / 2, 3, POCKET_DOOR_W,
             fill=COLORS["walls_interior"], stroke="none", rx=1, opacity=0.3)
    svg.text(bath_end + 6, door_cy, "pocket\ndoor", size=7, color=COLORS["text_muted"],
             anchor="start")

    # ── KITCHEN ──
    svg.comment("Kitchen fixtures")

    # Stairs along interior (top) wall, from living toward bathroom
    stair_depth = 28
    stair_x = bath_end + 4
    stair_y = oy + EW
    stair_length = KITCHEN_LENGTH + 48  # extends ~4' into living zone

    # Architectural stair cut: solid below the cut, dashed above
    # Cut happens roughly at the floor line (~60% of stair run)
    cut_frac = 0.6
    cut_x = stair_x + stair_length * cut_frac

    # Solid portion (below cut — visible on this floor)
    svg.rect(stair_x, stair_y, stair_length * cut_frac, stair_depth,
             fill="#F5EDD8", stroke=COLORS["stairs"], stroke_width=0.8, rx=2)
    # Dashed portion (above cut — continues to loft, shown as overhead)
    svg.rect(cut_x, stair_y, stair_length * (1 - cut_frac), stair_depth,
             fill="#F5EDD8", stroke=COLORS["stairs"], stroke_width=0.8,
             dash="4 3", rx=0, opacity=0.5)

    # Treads
    tread_count = 8
    tw = stair_length / tread_count
    for i in range(1, tread_count):
        tx = stair_x + i * tw
        is_above = tx > cut_x
        svg.line(tx, stair_y, tx, stair_y + stair_depth,
                 stroke=COLORS["stairs"], stroke_width=0.5,
                 dash="3 2" if is_above else None)

    # Diagonal break line (the architectural cut symbol)
    svg.line(cut_x - 6, stair_y, cut_x + 6, stair_y + stair_depth,
             stroke=COLORS["stairs"], stroke_width=1.5)

    svg.text(stair_x + stair_length * 0.3, stair_y + stair_depth / 2,
             "ALT. TREAD STAIRS", size=8, color=COLORS["stairs"], weight="600")
    # UP arrow (stairs go from right/living toward left/bathroom loft)
    svg.text(stair_x + 20, stair_y + stair_depth + 8,
             "← UP", size=9, color=COLORS["stairs"], weight="600")

    # Under-stair storage labels (below stairs on interior wall side)
    svg.text(stair_x + 14, stair_y + stair_depth + 8, "fridge",
             size=7, color=COLORS["text_muted"])
    svg.text(stair_x + 40, stair_y + stair_depth + 8, "W/D",
             size=7, color=COLORS["text_muted"])
    svg.text(stair_x + 72, stair_y + stair_depth + 8, "pantry",
             size=7, color=COLORS["text_muted"])
    svg.text(stair_x + KITCHEN_LENGTH + 10, stair_y + stair_depth + 8, "cubbies",
             size=7, color=COLORS["text_muted"])

    # Porch-side counter (bottom wall)
    counter_x = bath_end + 8
    counter_y = porch_y - EW - COUNTER_DEPTH
    counter_len = KITCHEN_LENGTH - 16
    svg.rect(counter_x, counter_y, counter_len, COUNTER_DEPTH,
             fill="#D4E4D6", stroke=COLORS["appliances"], stroke_width=0.5, rx=2)

    # Sink centered in counter
    sink_x = counter_x + (counter_len - SINK_W) / 2
    sink_y = counter_y + (COUNTER_DEPTH - SINK_D) / 2
    svg.fixture_rect(sink_x, sink_y, SINK_W, SINK_D, "SINK",
                     "#E8F0E9", COLORS["appliances"])

    # Cooktop right of sink
    cook_x = sink_x + SINK_W + 10
    cook_y = counter_y + (COUNTER_DEPTH - COOKTOP_D) / 2
    svg.fixture_rect(cook_x, cook_y, COOKTOP_W, COOKTOP_D, "COOK",
                     "#E8F0E9", COLORS["appliances"])

    # DishDrawer
    dd_x = cook_x + COOKTOP_W + 6
    dd_y = counter_y + (COUNTER_DEPTH - DISHDRAWER_D) / 2
    svg.fixture_rect(dd_x, dd_y, DISHDRAWER_W, DISHDRAWER_D, "DISH",
                     "#E8F0E9", COLORS["appliances"])

    # Kitchen window / bar pass-through (porch/bottom wall)
    svg.window(counter_x + 12, porch_y - EW, counter_len - 24, EW)
    svg.text(counter_x + counter_len / 2, porch_y + 8,
             "kitchen window / bar pass-through", size=8, color=COLORS["windows"])

    # Skylight (overhead, dashed)
    sky_x = bath_end + (KITCHEN_LENGTH - WINDOW_SMALL) / 2
    sky_y = oy + (W - WINDOW_SMALL) / 2
    svg.rect(sky_x, sky_y, WINDOW_SMALL, WINDOW_SMALL,
             fill="none", stroke=COLORS["windows"], stroke_width=0.8,
             dash="4 3", rx=2)
    svg.text(sky_x + WINDOW_SMALL / 2, sky_y + WINDOW_SMALL / 2,
             "skylight\n30×30", size=7, color=COLORS["windows"])

    # ── LIVING ──
    svg.comment("Living fixtures")

    # Woodstove — near interior wall (top) at kitchen/living boundary
    stove_x = kitchen_end + 6
    stove_y = oy + EW + stair_depth + 8
    svg.fixture_rect(stove_x, stove_y, WOODSTOVE, WOODSTOVE, "STOVE",
                     "#F5E8E4", "#C4705A")
    # Flue line going up through wall
    svg.circle(stove_x + WOODSTOVE / 2, stove_y - 4, 2.5,
               fill="none", stroke="#C4705A", stroke_width=1)

    # U-shaped couch wrapping end wall (right side)
    couch_depth = 28
    couch_arm = 24
    end_x = ox + L - EW - couch_depth

    # End wall section (right)
    svg.rect(end_x, oy + EW, couch_depth, W - 2 * EW,
             fill="#F5EDD8", stroke=COLORS["furniture"], stroke_width=0.5, rx=3)
    # Interior wall arm (top)
    svg.rect(end_x - couch_arm, oy + EW, couch_arm, couch_depth,
             fill="#F5EDD8", stroke=COLORS["furniture"], stroke_width=0.5, rx=3)
    # Porch side arm (bottom)
    svg.rect(end_x - couch_arm, porch_y - EW - couch_depth, couch_arm, couch_depth,
             fill="#F5EDD8", stroke=COLORS["furniture"], stroke_width=0.5, rx=3)
    svg.text(end_x + couch_depth / 2, oy + W / 2, "U-COUCH",
             size=9, color=COLORS["furniture"], weight="600")

    # Lift-top coffee table — center of U
    tbl_x = end_x - couch_arm - COFFEE_TABLE_L - 8
    tbl_y = oy + (W - COFFEE_TABLE_W) / 2
    svg.rect(tbl_x, tbl_y, COFFEE_TABLE_L, COFFEE_TABLE_W,
             fill="none", stroke=COLORS["furniture"], stroke_width=0.8, rx=3)
    svg.text(tbl_x + COFFEE_TABLE_L / 2, tbl_y + COFFEE_TABLE_W / 2,
             "lift-top table", size=8, color=COLORS["furniture"])

    # Desk — interior wall (top side)
    desk_x = kitchen_end + 30
    desk_y = oy + EW + stair_depth + 8
    svg.rect(desk_x, desk_y, DESK_L, DESK_W,
             fill="none", stroke=COLORS["text_muted"], stroke_width=0.5,
             dash="4 3", rx=2)
    svg.text(desk_x + DESK_L / 2, desk_y + DESK_W / 2, "DESK",
             size=9, color=COLORS["text_muted"])

    # Entry door — porch side (bottom wall)
    entry_x = kitchen_end + 8
    svg.rect(entry_x, porch_y - EW, ENTRY_DOOR_W, EW,
             fill=COLORS["doors"], stroke="none", rx=1, opacity=0.7)
    svg.text(entry_x + ENTRY_DOOR_W / 2, porch_y + 8, "ENTRY",
             size=9, color=COLORS["doors"], weight="600")

    # Living windows — porch side (bottom wall)
    svg.window(kitchen_end + ENTRY_DOOR_W + 24, porch_y - EW, 60, EW)
    svg.text(kitchen_end + ENTRY_DOOR_W + 54, porch_y + 8, "window",
             size=7, color=COLORS["windows"])

    # End wall window (right side)
    svg.window(ox + L - EW, oy + 24, EW, 60, vertical=True)
    svg.text(ox + L + 6, oy + 54, "end\nwindow", size=7, color=COLORS["windows"],
             anchor="start")

    # Gable end window (bathroom side, left)
    svg.window(ox, oy + 24, EW, 48, vertical=True)

    # Projector screen (dashed line across living width)
    proj_x = kitchen_end + 20
    svg.line(proj_x, oy + EW + 4, proj_x, porch_y - EW - 4,
             stroke=COLORS["furniture"], stroke_width=1, dash="6 4")
    svg.text(proj_x + 5, porch_y - EW - 12, "projector\nscreen",
             size=7, color=COLORS["furniture"], anchor="start")

    # ── Dimensions ──
    svg.comment("Dimensions")
    svg.dim_horizontal(ox, ox + L, porch_y, f"{L // 12}'-0\"", offset=14)
    svg.dim_vertical(oy, porch_y, ox, f"{W / 12:.0f}'-{W % 12:.0f}\"", offset=-14)
    svg.dim_horizontal(ox, bath_end, oy, f"{BATH_LENGTH // 12}'", offset=-10)
    svg.dim_horizontal(bath_end, kitchen_end, oy, f"{KITCHEN_LENGTH // 12}'", offset=-10)
    svg.dim_horizontal(kitchen_end, ox + L, oy, f"{LIVING_LENGTH // 12}'", offset=-10)

    svg.group_end()
    return porch_y


def draw_loft(svg, ox, oy):
    """Draw bedroom loft plan.

    Orientation matches main floor: top = interior wall, bottom = porch side.
    """
    L, W = LOFT_LENGTH, TRAILER_WIDTH
    EW = WALL_THICKNESS
    porch_y = oy + W

    svg.comment("===== BEDROOM LOFT =====")
    svg.group_start(id="loft")

    svg.text(ox + L / 2, oy - 18, "BEDROOM LOFT", size=14, color=COLORS["text"],
             weight="700", font="Georgia, serif")
    svg.text(ox + L / 2, oy - 8,
             f"~{L // 12}'-0\" × {W / 12:.0f}'-{W % 12:.0f}\"",
             size=11, color=COLORS["text_muted"])

    # Background
    svg.rect(ox + EW, oy + EW, L - 2 * EW, W - 2 * EW,
             fill=COLORS["loft_fill"], stroke="none")

    # Walls
    svg.rect(ox, oy, L, W, fill="none", stroke=COLORS["walls"], stroke_width=3)

    # King bed
    bed_x = ox + EW + 2
    bed_y = oy + (W - KING_BED_W) / 2
    svg.rect(bed_x, bed_y, KING_BED_L, KING_BED_W,
             fill="#EDEAF4", stroke=COLORS["fixtures"], stroke_width=0.8, rx=4)
    svg.text(bed_x + KING_BED_L / 2, bed_y + KING_BED_W / 2,
             "KING BED\n80\" × 76\"", size=11, color=COLORS["fixtures"],
             weight="600", font="Georgia, serif")

    # Pillows
    svg.rect(bed_x + 4, bed_y + 12, 10, 22,
             fill="none", stroke=COLORS["text_muted"], stroke_width=0.5,
             dash="3 2", rx=5)
    svg.rect(bed_x + 4, bed_y + KING_BED_W - 34, 10, 22,
             fill="none", stroke=COLORS["text_muted"], stroke_width=0.5,
             dash="3 2", rx=5)

    # Ledges — interior wall side (top)
    ledge_top_y = bed_y - LEDGE_WIDTH
    svg.rect(bed_x, ledge_top_y, KING_BED_L, LEDGE_WIDTH,
             fill="#F5EDD8", stroke=COLORS["furniture"], stroke_width=0.5, rx=1)
    svg.text(bed_x + KING_BED_L / 2, ledge_top_y + LEDGE_WIDTH / 2,
             "ledge ~11\"", size=7, color=COLORS["furniture"])

    # Ledges — porch side (bottom)
    ledge_bot_y = bed_y + KING_BED_W
    svg.rect(bed_x, ledge_bot_y, KING_BED_L, LEDGE_WIDTH,
             fill="#F5EDD8", stroke=COLORS["furniture"], stroke_width=0.5, rx=1)
    svg.text(bed_x + KING_BED_L / 2, ledge_bot_y + LEDGE_WIDTH / 2,
             "ledge ~11\"", size=7, color=COLORS["furniture"])

    # Partial wall at foot of bed
    wall_x = bed_x + KING_BED_L + 4
    svg.line(wall_x, oy + EW, wall_x, porch_y - EW,
             stroke=COLORS["walls"], stroke_width=3)
    svg.text(wall_x, oy - 3, "partial wall", size=8, color=COLORS["text_muted"])

    # Standing area where stairs arrive
    stand_x = wall_x + 4
    stand_w = L - (stand_x - ox) - EW
    svg.rect(stand_x, oy + EW, stand_w, W - 2 * EW,
             fill="none", stroke=COLORS["text_muted"], stroke_width=0.5, dash="4 3", rx=2)
    svg.text(stand_x + stand_w / 2, oy + W / 2 - 8, "standing ~28\"",
             size=9, color=COLORS["text_muted"])

    # Stair arrival indicator — architectural DN symbol
    svg.text(stand_x + stand_w / 2, oy + W / 2 + 4, "DN →",
             size=10, color=COLORS["stairs"], weight="600")
    svg.text(stand_x + stand_w / 2, oy + W / 2 + 14,
             "stairs to main floor", size=7, color=COLORS["stairs"])

    # Floor opening indicator (dashed outline of stair well)
    svg.rect(stand_x, oy + EW, stand_w, W - 2 * EW,
             fill="none", stroke=COLORS["stairs"], stroke_width=1, dash="6 3", rx=2)

    # Pipe railing
    svg.line(stand_x, oy + EW, stand_x, porch_y - EW,
             stroke=COLORS["fixtures"], stroke_width=1, dash="3 3")

    # Gable window (left)
    svg.window(ox, oy + 18, EW, 60, vertical=True)

    # Velux skylight
    sky_x = bed_x + (KING_BED_L - WINDOW_SMALL) / 2
    sky_y = oy + (W - WINDOW_SMALL) / 2
    svg.rect(sky_x, sky_y, WINDOW_SMALL, WINDOW_SMALL,
             fill="none", stroke=COLORS["windows"], stroke_width=0.8,
             dash="4 3", rx=2)
    svg.text(sky_x + WINDOW_SMALL / 2, sky_y + WINDOW_SMALL / 2,
             "VELUX\n30×30", size=8, color=COLORS["windows"])

    # Dimensions
    svg.dim_horizontal(ox, ox + L, porch_y, f"{L // 12}'-0\"", offset=10)
    svg.dim_vertical(oy, porch_y, ox, f"{W / 12:.0f}'-{W % 12:.0f}\"", offset=-10)
    svg.dim_horizontal(bed_x, bed_x + KING_BED_L, oy, "80\"", offset=-8)

    svg.group_end()
    return porch_y


def draw_porch(svg, ox, oy):
    """Draw covered porch plan."""
    L, W = PORCH_LENGTH, PORCH_WIDTH

    svg.comment("===== COVERED PORCH =====")
    svg.group_start(id="porch")

    svg.text(ox + L / 2, oy - 18, "COVERED PORCH", size=14, color=COLORS["text"],
             weight="700", font="Georgia, serif")
    svg.text(ox + L / 2, oy - 8,
             f"{L // 12}'-0\" × ~{W // 12}'-0\"  ·  modular bolt-together",
             size=11, color=COLORS["text_muted"])

    # Outline (dashed)
    svg.rect(ox, oy, L, W, fill=COLORS["porch_fill"],
             stroke=COLORS["doors"], stroke_width=1.5, dash="8 4", rx=4)

    # Section dividers
    sec = L / 3
    for i in range(1, 3):
        sx = ox + i * sec
        svg.line(sx, oy, sx, oy + W,
                 stroke=COLORS["text_muted"], stroke_width=0.5, dash="6 4")

    for i, label in enumerate(["section 1", "section 2", "section 3"]):
        svg.text(ox + sec * i + sec / 2, oy + W - 6, label,
                 size=8, color=COLORS["text_muted"])

    # Soaking tub
    tub_cx = ox + sec / 2
    tub_cy = oy + W / 2
    svg.circle(tub_cx, tub_cy, 28,
               fill="none", stroke=COLORS["text_muted"], stroke_width=0.5)
    svg.text(tub_cx, tub_cy, "SOAKING\nTUB", size=9, color=COLORS["text_muted"])

    # Bar counter
    bar_x = ox + sec + 12
    bar_w = sec - 24
    svg.rect(bar_x, oy + 8, bar_w, 16,
             fill="none", stroke=COLORS["furniture"], stroke_width=0.5, rx=2)
    svg.text(bar_x + bar_w / 2, oy + 16, "BAR COUNTER",
             size=8, color=COLORS["furniture"])

    # Grill
    svg.rect(ox + sec + 24, oy + W - 36, 36, 24,
             fill="none", stroke=COLORS["text_muted"], stroke_width=0.5, rx=2)
    svg.text(ox + sec + 42, oy + W - 24, "GRILL",
             size=8, color=COLORS["text_muted"])

    # Outdoor seating
    seat_x = ox + 2 * sec + 18
    svg.rect(seat_x, oy + 18, sec - 36, W - 36,
             fill="none", stroke=COLORS["text_muted"], stroke_width=0.5,
             dash="4 3", rx=3)
    svg.text(ox + 2.5 * sec, oy + W / 2, "OUTDOOR\nSEATING",
             size=10, color=COLORS["text_muted"])

    # 4×4 posts
    post_size = 3.5
    for px in [ox + 6, ox + sec, ox + 2 * sec, ox + L - 6]:
        svg.rect(px - post_size / 2, oy + W - post_size / 2,
                 post_size, post_size, fill=COLORS["walls_interior"],
                 stroke="none", rx=0.5)

    # Dimensions
    svg.dim_horizontal(ox, ox + L, oy + W, f"{L // 12}'-0\"", offset=10)
    svg.dim_vertical(oy, oy + W, ox, f"~{W // 12}'-0\"", offset=-10)

    svg.group_end()
    return oy + W


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    svg = SVGBuilder()
    y = 0

    top = draw_main_floor(svg, 0, y)
    y = top + VIEW_GAP

    top = draw_loft(svg, 0, y)
    y = top + VIEW_GAP

    top = draw_porch(svg, 0, y)

    total_w = TRAILER_LENGTH * SCALE + 60  # extra for dimensions
    total_h = top * SCALE + 40

    out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "plans")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "tiny-house-floorplan.svg")
    with open(out_path, "w") as f:
        f.write(svg.render(total_w, total_h))

    main_sqft = (TRAILER_LENGTH * TRAILER_WIDTH) / 144
    loft_sqft = (LOFT_LENGTH * TRAILER_WIDTH) / 144
    porch_sqft = (PORCH_LENGTH * PORCH_WIDTH) / 144
    print(f"SVG saved: {out_path}")
    print(f"  Main floor:  {TRAILER_LENGTH // 12}' × {TRAILER_WIDTH / 12:.1f}' = {main_sqft:.0f} sq ft")
    print(f"  Loft:        {LOFT_LENGTH // 12}' × {TRAILER_WIDTH / 12:.1f}' = {loft_sqft:.0f} sq ft")
    print(f"  Porch:       {PORCH_LENGTH // 12}' × {PORCH_WIDTH // 12}' = {porch_sqft:.0f} sq ft")
    print(f"  Total living: {main_sqft + loft_sqft:.0f} sq ft (+ {porch_sqft:.0f} sq ft covered outdoor)")


if __name__ == "__main__":
    main()
