"""
OTDR core logic — no GUI, no tkinter.
Extracted from OTDR_Generator.pyw for use by the web API.
"""
import os
import io
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from pyotdr import read
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, HRFlowable,
)
from reportlab.lib.utils import ImageReader


def parse_sor(filepath):
    status, results, tracedata = read.sorparse(filepath)
    return (results, tracedata) if status == "ok" else (None, None)


def trace_to_arrays(tracedata):
    distances, levels = [], []
    for line in tracedata:
        parts = line.strip().split('\t')
        if len(parts) == 2:
            try:
                distances.append(float(parts[0]))
                levels.append(float(parts[1]))
            except ValueError:
                pass
    return np.array(distances), np.array(levels)


def get_fiber_length(key_events, distances=None, levels=None):
    n = key_events.get('num events', 0)
    last = key_events.get(f'event {n}', {})
    dist = last.get('distance', None)
    if dist is not None:
        try:
            km = float(dist)
            if km > 0:
                return f'{km:.3f} km ({km*1000:.0f} m)'
        except ValueError:
            pass
    # fallback: Fresnel end-of-fiber shows as a LEVEL PEAK (reflectance rises)
    if distances is not None and levels is not None and len(distances) > 100:
        d = np.array(distances, dtype=float)
        l = np.array(levels, dtype=float)
        skip = max(10, int(np.searchsorted(d, 0.05)))
        if skip < len(l):
            peak_idx = int(np.argmax(l[skip:])) + skip
            if l[peak_idx] > l[skip] + 2.0:
                km = float(d[peak_idx])
                return f'{km:.3f} km ({km*1000:.0f} m)'
    return '-'


def get_events_table_data(key_events):
    rows = [['#', 'Distance (km)', 'Type', 'Splice Loss (dB)', 'Refl Loss (dB)', 'Slope (dB/km)']]
    for k, v in key_events.items():
        if not k.startswith('event'):
            continue
        ev_type = v.get('type', '')
        short_type = ('Reflection' if 'reflection' in ev_type.lower()
                      else 'End of Fiber' if 'end' in ev_type.lower()
                      else ev_type[:20])
        rows.append([k.replace('event ', ''), v.get('distance', '-'), short_type,
                     v.get('splice loss', '-'), v.get('refl loss', '-'), v.get('slope', '-')])
    return rows


def make_trace_image(distances, levels, events, fiber_num, wavelength):
    fig, ax = plt.subplots(figsize=(7, 2), dpi=100)
    if len(distances) > 0:
        ax.plot(distances, levels, color='#1565C0', linewidth=0.8, alpha=0.9)
        ax.set_xlim(0, max(distances) * 1.02 if max(distances) > 0 else 1)
        valid = [l for l in levels if l > 0]
        ymin = (min(valid) - 2) if valid else 0
        ymax = (max(valid) + 3) if valid else 40
        ax.set_ylim(ymin, ymax)
        for ev_key, ev in events.items():
            if not ev_key.startswith('event'):
                continue
            try:
                d = float(ev.get('distance', 0))
                if 0 < d <= max(distances):
                    ax.axvline(x=d, color='red', linewidth=0.7, linestyle='--', alpha=0.6)
            except (ValueError, TypeError):
                pass
    ax.set_xlabel('Distance (km)', fontsize=7)
    ax.set_ylabel('Level (dB)', fontsize=7)
    ax.set_title(f'Fiber #{fiber_num:02d}  |  {wavelength}', fontsize=8, fontweight='bold')
    ax.grid(True, alpha=0.3, linewidth=0.5)
    ax.tick_params(labelsize=6)
    fig.tight_layout(pad=0.4)
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=100, bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    return buf


def build_pdf(sor_files, output_pdf, project_name="OTDR", logo_path=None, progress_cb=None):
    if progress_cb is None:
        progress_cb = lambda msg: None

    W, H = A4

    def _draw_logo_header(canvas, doc):
        if logo_path and os.path.exists(logo_path):
            canvas.saveState()
            try:
                ir = ImageReader(logo_path)
                iw, ih = ir.getSize()
                logo_w = 28 * mm
                logo_h = min(logo_w * ih / iw, 10 * mm)
                x = doc.pagesize[0] - doc.rightMargin - logo_w
                y = doc.pagesize[1] - logo_h - 4 * mm
                canvas.drawImage(logo_path, x, y, width=logo_w, height=logo_h,
                                 preserveAspectRatio=True, mask='auto')
                canvas.setFont('Helvetica-Bold', 7)
                canvas.setFillColor(colors.HexColor('#1565C0'))
                cx = x + logo_w / 2
                canvas.drawCentredString(cx, y - 8, 'NDT OTDR Report')
            except Exception:
                pass
            canvas.restoreState()

    def _draw_first_page(canvas, doc):
        _draw_logo_header(canvas, doc)
        canvas.saveState()
        canvas.setFont('Helvetica', 7)
        canvas.setFillColor(colors.HexColor('#AAAAAA'))
        canvas.drawCentredString(doc.pagesize[0] / 2, doc.bottomMargin / 2,
                                 'Powered by Netdoi Technology')
        canvas.restoreState()

    def _draw_later_pages(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 7)
        canvas.setFillColor(colors.HexColor('#AAAAAA'))
        canvas.drawCentredString(doc.pagesize[0] / 2, doc.bottomMargin / 2,
                                 'Powered by Netdoi Technology')
        canvas.restoreState()

    doc = SimpleDocTemplate(output_pdf, pagesize=A4,
                            leftMargin=15*mm, rightMargin=15*mm,
                            topMargin=8*mm, bottomMargin=15*mm)

    TBL_HEADER = TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1565C0')),
        ('TEXTCOLOR',  (0,0), (-1,0), colors.white),
        ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',   (0,0), (-1,0), 8),
        ('ALIGN',      (0,0), (-1,-1), 'CENTER'),
        ('VALIGN',     (0,0), (-1,-1), 'MIDDLE'),
        ('FONTNAME',   (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE',   (0,1), (-1,-1), 8),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#EEF2FF')]),
        ('GRID',       (0,0), (-1,-1), 0.4, colors.HexColor('#CCCCCC')),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ])

    info_style = TableStyle([
        ('FONTNAME',  (0,0), (0,-1), 'Helvetica-Bold'),
        ('FONTNAME',  (2,0), (2,-1), 'Helvetica-Bold'),
        ('FONTNAME',  (4,0), (4,-1), 'Helvetica-Bold'),
        ('FONTSIZE',  (0,0), (-1,-1), 7.5),
        ('TEXTCOLOR', (0,0), (0,-1), colors.HexColor('#1565C0')),
        ('TEXTCOLOR', (2,0), (2,-1), colors.HexColor('#1565C0')),
        ('TEXTCOLOR', (4,0), (4,-1), colors.HexColor('#1565C0')),
        ('VALIGN',    (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 1.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.5),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [colors.white, colors.HexColor('#F5F5F5')]),
        ('LINEBELOW', (0,0), (-1,-1), 0.3, colors.HexColor('#DDDDDD')),
        ('LEFTPADDING',  (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ])

    summ_style = TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0D47A1')),
        ('TEXTCOLOR',  (0,0), (-1,0), colors.white),
        ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTNAME',   (0,1), (-1,1), 'Helvetica-Bold'),
        ('FONTSIZE',   (0,0), (-1,-1), 8),
        ('ALIGN',      (0,0), (-1,-1), 'CENTER'),
        ('VALIGN',     (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,1), (-1,1), colors.HexColor('#E3F2FD')),
        ('GRID',       (0,0), (-1,-1), 0.4, colors.HexColor('#CCCCCC')),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ])

    style_title  = ParagraphStyle('t', fontName='Helvetica-Bold', fontSize=22, alignment=TA_CENTER, spaceAfter=4, textColor=colors.HexColor('#0D47A1'))
    style_sub    = ParagraphStyle('s', fontName='Helvetica', fontSize=11, alignment=TA_CENTER, spaceAfter=2, textColor=colors.HexColor('#555555'))
    style_fhdr   = ParagraphStyle('fh', fontName='Helvetica-Bold', fontSize=10, spaceBefore=0, spaceAfter=1, textColor=colors.white)
    style_evhdr  = ParagraphStyle('eh', fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor('#1565C0'), spaceBefore=1, spaceAfter=1)

    cover_dt = '-'
    if sor_files:
        try:
            _r, _ = parse_sor(sor_files[0])
            if _r:
                raw = _r.get('FxdParams', {}).get('date/time', '-') or '-'
                cover_dt = raw.split('(')[0].strip() if '(' in raw else raw
        except Exception:
            pass

    story = []
    story.append(Spacer(1, 6*mm))
    story.append(Spacer(1, 8*mm))

    summary_rows = [['Fiber', 'File', 'Wavelength', 'Fiber Length', 'Pulse', 'Avg Time', 'Total Loss (dB)']]
    all_data = []
    for i, fpath in enumerate(sor_files):
        progress_cb(f"Reading {i+1}/{len(sor_files)}: {os.path.basename(fpath)}")
        results, tracedata = parse_sor(fpath)
        all_data.append((results, tracedata))
        fname = os.path.basename(fpath)
        if results is None:
            summary_rows.append([f'#{i+1:02d}', fname, 'ERROR', '-', '-', '-', '-'])
            continue
        gp = results.get('GenParams', {})
        fp = results.get('FxdParams', {})
        ke = results.get('KeyEvents', {})
        total_loss = ke.get('Summary', {}).get('total loss', 0.0)
        _d, _l = trace_to_arrays(tracedata)
        summary_rows.append([
            f'#{i+1:02d}',
            fname,
            gp.get('wavelength', '-'),
            get_fiber_length(ke, _d if len(_d) > 0 else None, _l if len(_l) > 0 else None),
            fp.get('pulse width', '-'),
            fp.get('averaging time', '-'),
            f'{total_loss:.3f}' if isinstance(total_loss, float) else str(total_loss),
        ])

    style_sumhdr = ParagraphStyle('sh', fontName='Helvetica-Bold', fontSize=13,
                                   textColor=colors.HexColor('#0D47A1'), spaceAfter=2)
    style_summeta = ParagraphStyle('sm', fontName='Helvetica', fontSize=8,
                                    textColor=colors.HexColor('#555555'), spaceAfter=4)
    story.append(Paragraph("Fiber Optic Test Results", style_sumhdr))
    story.append(Paragraph(
        f"Project: {project_name} &nbsp;&nbsp;|&nbsp;&nbsp; Test Date: {cover_dt} &nbsp;&nbsp;|&nbsp;&nbsp; Total Fibers: {len(sor_files)}",
        style_summeta))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1565C0')))
    story.append(Spacer(1, 2*mm))
    summary_tbl = Table(summary_rows, colWidths=[12*mm, 30*mm, 18*mm, 36*mm, 16*mm, 16*mm, 24*mm], repeatRows=1)
    summary_tbl.setStyle(TBL_HEADER)
    story.append(summary_tbl)
    story.append(PageBreak())

    def fiber_block(fiber_num, results, tracedata, fname):
        block = []
        if results is None:
            block.append(Paragraph(f"Fiber #{fiber_num:02d} — Parse Error", style_fhdr))
            return block
        gp = results.get('GenParams', {})
        fp = results.get('FxdParams', {})
        ke = results.get('KeyEvents', {})

        wav = gp.get('wavelength', '-')
        dt  = fp.get('date/time', '-') or '-'
        if '(' in dt:
            dt = dt.split('(')[0].strip()

        hdr_data = [[Paragraph(f"Fiber #{fiber_num:02d}  —  {wav}  |  {fname}  |  {dt}", style_fhdr)]]
        hdr_tbl = Table(hdr_data, colWidths=[W - 30*mm])
        hdr_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#1565C0')),
            ('TOPPADDING',    (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING',   (0,0), (-1,-1), 8),
        ]))
        block.append(hdr_tbl)
        block.append(Spacer(1, 1*mm))

        res_str = (f"{fp.get('resolution',0):.5f} m"
                   if isinstance(fp.get('resolution'), float) else '-')
        info_data = [
            ['Wavelength', wav,
             'Pulse',     fp.get('pulse width', '-'),
             'Range',     f"{fp.get('acquisition range distance','-')} m"],
            ['Fiber Type', gp.get('fiber type', '-'),
             'Avg Time',  fp.get('averaging time', '-'),
             'Ref Index', fp.get('index', '-')],
            ['Location A', gp.get('location A', '-').strip() or '-',
             'Location B', gp.get('location B', '-').strip() or '-',
             'Resolution', res_str],
        ]
        info_tbl = Table(info_data, colWidths=[20*mm, 38*mm, 18*mm, 26*mm, 20*mm, 30*mm])
        info_tbl.setStyle(info_style)
        block.append(info_tbl)
        block.append(Spacer(1, 1.5*mm))

        distances, levels = trace_to_arrays(tracedata)
        fiber_len_str = get_fiber_length(ke, distances if len(distances) > 0 else None, levels if len(levels) > 0 else None)
        img_buf = make_trace_image(distances, levels, ke, fiber_num, wav)
        block.append(Image(img_buf, width=170*mm, height=50*mm))
        block.append(Spacer(1, 1.5*mm))

        block.append(Paragraph("Key Events", style_evhdr))
        ev_rows = get_events_table_data(ke)
        ev_tbl  = Table(ev_rows, colWidths=[10*mm, 26*mm, 42*mm, 30*mm, 30*mm, 28*mm])
        ev_tbl.setStyle(TBL_HEADER)
        block.append(ev_tbl)
        block.append(Spacer(1, 1.5*mm))

        summ = ke.get('Summary', {})
        summ_data = [
            ['Total Loss (dB)', 'ORL (dB)', 'Loss Start (km)', 'Loss End (km)'],
            [f"{summ.get('total loss', 0.0):.3f}",
             f"{summ.get('ORL', 0.0):.3f}",
             f"{summ.get('loss start', 0.0):.3f}",
             f"{summ.get('loss end', 0.0):.3f}"],
        ]
        summ_tbl = Table(summ_data, colWidths=[42*mm, 42*mm, 42*mm, 42*mm])
        summ_tbl.setStyle(summ_style)
        block.append(summ_tbl)
        return block

    for i, (results, tracedata) in enumerate(all_data):
        fiber_num = i + 1
        progress_cb(f"Rendering fiber {fiber_num}/{len(sor_files)}...")
        story.extend(fiber_block(fiber_num, results, tracedata, os.path.basename(sor_files[i])))
        if fiber_num < len(sor_files):
            if fiber_num % 2 == 0:
                story.append(PageBreak())
            else:
                story.append(Spacer(1, 3*mm))
                story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CCCCCC')))
                story.append(Spacer(1, 3*mm))

    progress_cb("Writing PDF...")
    doc.build(story, onFirstPage=_draw_first_page, onLaterPages=_draw_later_pages)
