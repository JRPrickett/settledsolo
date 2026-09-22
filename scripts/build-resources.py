#!/usr/bin/env python3
"""Build the first-party SettledSolo printable resources."""

from __future__ import annotations

import argparse
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


PAGE_W, PAGE_H = A4
INK = colors.HexColor("#15242C")
MUTED = colors.HexColor("#64716E")
PAPER = colors.HexColor("#FBF7EF")
PAGE = colors.HexColor("#F4F1EB")
SAGE = colors.HexColor("#DCE8DF")
SAGE_DARK = colors.HexColor("#3E6249")
GLOW = colors.HexColor("#F2A65A")
ROSE = colors.HexColor("#F3DFDC")
LINE = colors.HexColor("#D9DED8")

FONT_ROOT = Path("/usr/share/fonts/truetype/dejavu")
if not (FONT_ROOT / "DejaVuSans.ttf").exists():
    FONT_ROOT = Path(
        "/opt/codex/runtimes/codex-primary-runtime/dependencies/native/"
        "libreoffice-headless/libreoffice/share/fonts/truetype"
    )
pdfmetrics.registerFont(TTFont("SettledSans", str(FONT_ROOT / "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("SettledSans-Bold", str(FONT_ROOT / "DejaVuSans-Bold.ttf")))


def styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "eyebrow": ParagraphStyle(
            "eyebrow", parent=base["Normal"], fontName="SettledSans-Bold",
            fontSize=8, leading=10, textColor=SAGE_DARK, spaceAfter=7,
        ),
        "title": ParagraphStyle(
            "title", parent=base["Title"], fontName="SettledSans-Bold",
            fontSize=27, leading=29, textColor=INK, spaceAfter=9,
        ),
        "intro": ParagraphStyle(
            "intro", parent=base["BodyText"], fontName="SettledSans",
            fontSize=10.5, leading=15, textColor=MUTED, spaceAfter=10,
        ),
        "section": ParagraphStyle(
            "section", parent=base["Heading2"], fontName="SettledSans-Bold",
            fontSize=13, leading=16, textColor=INK, spaceBefore=10, spaceAfter=5,
        ),
        "body": ParagraphStyle(
            "body", parent=base["BodyText"], fontName="SettledSans",
            fontSize=9.5, leading=13.5, textColor=INK, spaceAfter=5,
        ),
        "small": ParagraphStyle(
            "small", parent=base["BodyText"], fontName="SettledSans",
            fontSize=8, leading=10.5, textColor=MUTED, spaceAfter=3,
        ),
        "card_title": ParagraphStyle(
            "card_title", parent=base["Heading3"], fontName="SettledSans-Bold",
            fontSize=11, leading=13, textColor=INK, spaceAfter=3,
        ),
        "card_body": ParagraphStyle(
            "card_body", parent=base["BodyText"], fontName="SettledSans",
            fontSize=8.7, leading=12, textColor=INK,
        ),
        "center_small": ParagraphStyle(
            "center_small", parent=base["BodyText"], fontName="SettledSans",
            fontSize=8, leading=10, textColor=MUTED, alignment=TA_CENTER,
        ),
    }


def p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text, style)


def header_footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFillColor(PAGE)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    canvas.setFillColor(GLOW)
    canvas.circle(24 * mm, PAGE_H - 20 * mm, 4 * mm, stroke=0, fill=1)
    canvas.setFillColor(INK)
    canvas.setFont("SettledSans-Bold", 9)
    canvas.drawString(32 * mm, PAGE_H - 21 * mm, "SettledSolo")
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, 16 * mm, PAGE_W - 20 * mm, 16 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("SettledSans", 7.5)
    canvas.drawString(20 * mm, 10.5 * mm, "First-party practical guidance | settledsolo.com/evidence")
    canvas.drawRightString(PAGE_W - 20 * mm, 10.5 * mm, f"{doc.page}")
    canvas.restoreState()


def callout(text: str, style: ParagraphStyle, background=SAGE) -> Table:
    table = Table([[p(text, style)]], colWidths=[170 * mm])
    table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), background),
            ("BOX", (0, 0), (-1, -1), 0.5, LINE),
            ("ROUNDEDCORNERS", [8, 8, 8, 8]),
            ("LEFTPADDING", (0, 0), (-1, -1), 11),
            ("RIGHTPADDING", (0, 0), (-1, -1), 11),
            ("TOPPADDING", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ])
    )
    return table


def step_table(items: list[tuple[str, str]], style_map: dict[str, ParagraphStyle]) -> Table:
    rows = []
    for index, (title, body) in enumerate(items, 1):
        rows.append([
            p(f"{index:02d}", ParagraphStyle(
                f"step_{index}", parent=style_map["card_title"],
                textColor=SAGE_DARK, fontSize=13, leading=14,
            )),
            [p(title, style_map["card_title"]), p(body, style_map["card_body"])],
        ])
    table = Table(rows, colWidths=[15 * mm, 155 * mm], hAlign="LEFT")
    table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 0), (-1, -1), PAPER),
            ("BOX", (0, 0), (-1, -1), 0.5, LINE),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ])
    )
    return table


def build_cheatsheet(path: Path) -> None:
    s = styles()
    story = [
        p("ONE-SESSION CHEAT SHEET", s["eyebrow"]),
        p("A calmer next step", s["title"]),
        p(
            "Use this beside the app when you want a simple reminder of what to watch. "
            "The goal is not to prove how long your dog can stay alone; it is to keep the "
            "experience manageable enough to learn from.",
            s["intro"],
        ),
        callout(
            "<b>Core rule:</b> the target is a ceiling, never a quota. Returning early is useful information.",
            s["body"],
        ),
        Spacer(1, 5 * mm),
        step_table([
            ("Choose an easy starting point", "Use a duration your dog has already handled comfortably. Do not wait for distress to discover a limit."),
            ("Make the departure ordinary", "Keep the room, door and goodbye as uneventful as practical. Use a camera or another observation method when it helps."),
            ("Watch for the first change", "Look beyond barking: pacing, panting, exit-watching, repeated vocalising, food refusal or an inability to settle can all be useful observations."),
            ("Return before distress builds", "If meaningful concern appears, come back. A shorter relaxed departure is better training information than a longer difficult one."),
            ("Let recovery guide the next step", "Give your dog time to settle. Record what happened, then repeat, simplify or stop for the day based on the whole picture."),
        ], s),
        Spacer(1, 5 * mm),
        p("After the session, jot down", s["section"]),
        p(
            "Planned time: __________   Actual time: __________   Outcome: relaxed / some concern / distressed<br/>"
            "First useful observation: ________________________________________________________________<br/>"
            "Context or recovery note: _________________________________________________________________",
            s["body"],
        ),
        callout(
            "Pause timed departures and contact a vet or qualified behaviour professional for self-injury, destructive escape attempts, rapidly escalating distress or repeated sessions that cannot stay manageable.",
            s["small"],
            ROSE,
        ),
    ]
    SimpleDocTemplate(
        str(path), pagesize=A4, rightMargin=20 * mm, leftMargin=20 * mm,
        topMargin=27 * mm, bottomMargin=23 * mm,
        title="SettledSolo one-session cheat sheet",
        author="SettledSolo",
    ).build(story, onFirstPage=header_footer, onLaterPages=header_footer)


def build_setback(path: Path) -> None:
    s = styles()
    story = [
        p("WHEN A SESSION GOES BADLY", s["eyebrow"]),
        p("A setback is information", s["title"]),
        p(
            "Difficult sessions happen. They do not mean you have failed or that your dog is being stubborn. Use the checklist to protect recovery and choose a smaller next step.",
            s["intro"],
        ),
        callout(
            "<b>Do not catch up.</b> A harder session to make up for a difficult one can rehearse the very experience you are trying to reduce.",
            s["body"],
            ROSE,
        ),
        Spacer(1, 4 * mm),
        p("Immediate checklist", s["section"]),
        step_table([
            ("[ ]", "End the absence and help your dog return to a calm, ordinary state."),
            ("[ ]", "Write down the first sign you noticed, not only the final outcome."),
            ("[ ]", "Check the context: illness, noise, visitors, confinement, routine change or something unusual."),
            ("[ ]", "Make the next planned absence shorter and simpler, or take a rest day."),
            ("[ ]", "Cover unavoidable real absences where possible with a sitter, daycare, a friend or a schedule change."),
        ], s),
        Spacer(1, 4 * mm),
        p("What to review before trying again", s["section"]),
        Table([
            [p("What changed?", s["card_title"]), p("________________________________________________", s["body"])],
            [p("What was the dog doing?", s["card_title"]), p("________________________________________________", s["body"])],
            [p("What would make it easier?", s["card_title"]), p("________________________________________________", s["body"])],
        ], colWidths=[46 * mm, 124 * mm], style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), PAPER),
            ("BOX", (0, 0), (-1, -1), 0.5, LINE),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 11),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
        ])),
        Spacer(1, 5 * mm),
        callout(
            "Seek help promptly for self-injury, destructive escape behaviour, rapidly escalating distress or repeated difficulty that is not becoming more manageable. A vet can also discuss medical questions.",
            s["small"],
            SAGE,
        ),
    ]
    SimpleDocTemplate(
        str(path), pagesize=A4, rightMargin=20 * mm, leftMargin=20 * mm,
        topMargin=27 * mm, bottomMargin=23 * mm,
        title="SettledSolo setback checklist",
        author="SettledSolo",
    ).build(story, onFirstPage=header_footer, onLaterPages=header_footer)


def build_observation_log(path: Path) -> None:
    s = styles()
    rows = [[
        p("Date / time", s["card_title"]), p("Planned", s["card_title"]),
        p("Actual", s["card_title"]), p("Outcome", s["card_title"]),
        p("First useful observation", s["card_title"]),
    ]]
    for _ in range(5):
        rows.append([p("\n\n", s["body"]), p("\n\n", s["body"]), p("\n\n", s["body"]), p("\n\n", s["body"]), p("\n\n", s["body"])])
    log_table = Table(rows, colWidths=[27 * mm, 22 * mm, 22 * mm, 24 * mm, 75 * mm], repeatRows=1)
    log_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), SAGE),
        ("BACKGROUND", (0, 1), (-1, -1), PAPER),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, 0), 7),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 7),
        ("TOPPADDING", (0, 1), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 14),
    ]))
    story = [
        p("OBSERVATION LOG", s["eyebrow"]),
        p("Notice the whole picture", s["title"]),
        p(
            "A simple printable record for the details that a timer cannot capture. Record what you actually observed; this is not a diagnostic checklist.",
            s["intro"],
        ),
        callout(
            "Useful signs can include pacing, panting, exit-watching, vocalising, food refusal, inability to settle or escape/destructive behaviour. Leave a box blank when you did not observe or record it.",
            s["small"],
        ),
        Spacer(1, 5 * mm),
        log_table,
        Spacer(1, 5 * mm),
        p("Context notes", s["section"]),
        p("Before leaving:  _________________________________________________________________", s["body"]),
        p("Between repetitions:  _____________________________________________________________", s["body"]),
        p("Recovery afterwards:  _____________________________________________________________", s["body"]),
        Spacer(1, 2 * mm),
        callout(
            "If a dog is showing clear or escalating distress, stop collecting data and prioritise safety. Pause timed departures and seek veterinary or qualified behaviour support when needed.",
            s["small"],
            ROSE,
        ),
    ]
    SimpleDocTemplate(
        str(path), pagesize=A4, rightMargin=20 * mm, leftMargin=20 * mm,
        topMargin=27 * mm, bottomMargin=23 * mm,
        title="SettledSolo observation log",
        author="SettledSolo",
    ).build(story, onFirstPage=header_footer, onLaterPages=header_footer)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output-dir", default="app-v2/public/resources", type=Path,
        help="Directory for the generated PDFs",
    )
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    build_cheatsheet(args.output_dir / "settledsolo-session-cheatsheet.pdf")
    build_setback(args.output_dir / "settledsolo-setback-checklist.pdf")
    build_observation_log(args.output_dir / "settledsolo-observation-log.pdf")


if __name__ == "__main__":
    main()
