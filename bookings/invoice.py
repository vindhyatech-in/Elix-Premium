import io

from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def generate_booking_receipt_pdf(booking):
    """
    A simple itemized PDF receipt for a paid booking — reportlab was
    already a declared dependency (requirements.txt) with no call site
    yet, so this is the first thing to actually use it. Only meant for
    bookings that have genuinely been paid for (see bookings/views.py's
    payment_status='paid' gate) — this never guesses/estimates a total,
    it only reprints the booking's own already-frozen amounts.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=20 * mm, bottomMargin=20 * mm, leftMargin=20 * mm, rightMargin=20 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('ReceiptTitle', parent=styles['Title'], fontSize=20, spaceAfter=2)
    muted_style = ParagraphStyle('Muted', parent=styles['Normal'], textColor=colors.HexColor('#64748b'))
    heading_style = ParagraphStyle('SectionHeading', parent=styles['Heading3'], spaceBefore=10, spaceAfter=4)

    elements = [
        Paragraph(settings.SITE_NAME, title_style),
        Paragraph(settings.SITE_ADDRESS, muted_style),
        Paragraph(f'{settings.SITE_PHONE} · {settings.SITE_EMAIL}', muted_style),
        Spacer(1, 10 * mm),
        Paragraph('Payment Receipt', heading_style),
    ]

    # booking.user can be None — deleting a customer's account keeps the
    # booking for revenue records but nulls the FK (see Booking.user).
    if booking.user:
        customer_name = booking.user.get_full_name() or booking.user.username
    else:
        customer_name = 'Guest (account deleted)'
    meta_rows = [
        ['Receipt No.', booking.booking_number],
        ['Booking Date', booking.created_at.strftime('%d %b %Y, %I:%M %p')],
        ['Service Date', booking.scheduled_date.strftime('%d %b %Y')],
        ['Customer', customer_name],
        ['Address', f'{booking.address_label} — {booking.address_text}'],
        ['Payment Method', booking.get_payment_method_display()],
    ]
    if booking.razorpay_payment_id:
        meta_rows.append(['Payment Reference', booking.razorpay_payment_id])

    meta_table = Table(meta_rows, colWidths=[40 * mm, 130 * mm])
    meta_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9.5),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#64748b')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 8 * mm))

    elements.append(Paragraph('Items', heading_style))
    item_rows = [['Service', 'Qty', 'Price', 'Amount']]
    for item in booking.items.all():
        amount = item.price_snapshot * item.quantity
        item_rows.append([item.name_snapshot, str(item.quantity), f'Rs. {item.price_snapshot:.2f}', f'Rs. {amount:.2f}'])

    items_table = Table(item_rows, colWidths=[90 * mm, 20 * mm, 30 * mm, 30 * mm])
    items_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9.5),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('LINEBELOW', (0, 0), (-1, 0), 0.75, colors.HexColor('#0f172a')),
        ('LINEBELOW', (0, -1), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 6 * mm))

    totals_rows = [['Subtotal', f'Rs. {booking.subtotal:.2f}']]
    if booking.discount_amount:
        label = f'Discount ({booking.coupon_code})' if booking.coupon_code else 'Discount'
        totals_rows.append([label, f'-Rs. {booking.discount_amount:.2f}'])
    totals_rows.append(['Total Paid', f'Rs. {booking.total_amount:.2f}'])

    totals_table = Table(totals_rows, colWidths=[140 * mm, 30 * mm])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTSIZE', (0, 0), (-1, -1), 9.5),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 11),
        ('LINEABOVE', (0, -1), (-1, -1), 0.75, colors.HexColor('#0f172a')),
        ('TOPPADDING', (0, -1), (-1, -1), 6),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 12 * mm))
    elements.append(Paragraph('Thank you for booking with us!', muted_style))

    doc.build(elements)
    return buffer.getvalue()
