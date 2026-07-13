import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportPDF(filename: string, title: string, headers: string[], rows: (string | number)[][]) {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text(title, 14, 15)
  autoTable(doc, {
    head: [headers],
    body: rows.map((r) => r.map(String)),
    startY: 20,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
  })
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}
