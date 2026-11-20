import { useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, FileText, LockKeyhole } from 'lucide-react'
import { dateLabel, today, type RecordItem } from './data'

/** Only program/activity reporting. Individual student identity and confidential notes are not exported. */
export const serviceReportModules = [
  { key: 'group', label: 'Konseling kelompok', fields: [['Kelas sasaran', 'class_target']] },
  { key: 'classical', label: 'Layanan klasikal', fields: [['Kelas sasaran', 'class_target'], ['Metode', 'method'], ['Media', 'media'], ['Jumlah hadir', 'attendance']] },
  { key: 'rpl', label: 'RPL layanan', fields: [['Tujuan layanan', 'goal'], ['Metode', 'method'], ['Media', 'media'], ['Evaluasi', 'evaluation']] },
  { key: 'program', label: 'Program BK', fields: [['Sasaran', 'target'], ['Indikator keberhasilan', 'indicator']] },
  { key: 'agenda', label: 'Agenda', fields: [['Waktu', 'time'], ['Lokasi', 'location']] },
  { key: 'career', label: 'Perencanaan karier', fields: [] },
  { key: 'document', label: 'Dokumen', fields: [['Jenis dokumen', 'document_type']] },
] as const

type Cell = string | number
type Sheet = { name: string; rows: Cell[][] }
type ReportItem = { id: string; kind: string; date: string; title: string; target: string; domain: string; status: string; details: Record<string, string> }
const dash = (value: unknown) => String(value ?? '').trim() || '—'
const xml = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'semua'

function safeItem(r: RecordItem): ReportItem {
  // Never export student names/NIS, participant lists, URLs, free-text notes, or confidential records.
  const individual = Boolean(r.student_id)
  const fields = serviceReportModules.find(m => m.key === r.kind)?.fields ?? []
  const details: Record<string, string> = {}
  for (const [label, key] of fields) details[label] = individual ? 'Disamarkan (individu)' : dash(r.details?.[key])
  return {
    id: r.id, kind: r.kind, date: r.happened_on,
    title: individual ? 'Layanan individu (judul dirahasiakan)' : dash(r.title),
    target: individual ? 'Individu (tanpa identitas)' : (r.details?.class_target || r.details?.target || 'Umum / kelompok'),
    domain: dash(r.domain), status: dash(r.status), details,
  }
}

function enc(s: string): Uint8Array { return new TextEncoder().encode(s) }
function w16(n: number): number[] { return [n & 255, (n >>> 8) & 255] }
function w32(n: number): number[] { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255] }
function concat(arrays: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(arrays.reduce((sum, arr) => sum + arr.length, 0))
  let offset = 0
  for (const arr of arrays) { out.set(arr, offset); offset += arr.length }
  return out
}
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
/** Standards-compliant uncompressed ZIP/OOXML, without third-party dependencies. */
function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const locals: Uint8Array[] = [], directory: Uint8Array[] = []
  let position = 0
  for (const file of files) {
    const name = enc(file.name), size = file.data.length, crc = crc32(file.data)
    const local = new Uint8Array([
      ...w32(0x04034b50), ...w16(20), ...w16(0), ...w16(0),
      ...w16(0), ...w16(0), ...w32(crc), ...w32(size), ...w32(size),
      ...w16(name.length), ...w16(0), ...name,
    ])
    locals.push(local, file.data)
    directory.push(new Uint8Array([
      ...w32(0x02014b50), ...w16(20), ...w16(20), ...w16(0), ...w16(0),
      ...w16(0), ...w16(0), ...w32(crc), ...w32(size), ...w32(size),
      ...w16(name.length), ...w16(0), ...w16(0), ...w16(0), ...w16(0),
      ...w32(0), ...w32(position), ...name,
    ]))
    position += local.length + size
  }
  const dirSize = directory.reduce((sum, part) => sum + part.length, 0)
  return concat([...locals, ...directory, new Uint8Array([
    ...w32(0x06054b50), ...w16(0), ...w16(0), ...w16(files.length), ...w16(files.length),
    ...w32(dirSize), ...w32(position), ...w16(0),
  ])])
}
function excelCol(n: number): string {
  let result = ''
  for (let i = n + 1; i > 0; i = Math.floor((i - 1) / 26)) result = String.fromCharCode(65 + ((i - 1) % 26)) + result
  return result
}
function worksheet(rows: Cell[][]): string {
  const cols = Math.max(1, ...rows.map(r => r.length))
  const widths = Array.from({ length: cols }, (_, i) => Math.min(56, Math.max(13, ...rows.map(r => String(r[i] ?? '').length + 3))))
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<cols>' + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>' +
    '<sheetData>' + rows.map((row, y) => {
      const heading = y === 0 || row[0] === 'No'
      return '<row r="' + (y + 1) + '">' + row.map((val, x) => {
        const attrs = ' r="' + excelCol(x) + (y + 1) + '"' + (heading ? ' s="1"' : '')
        return typeof val === 'number'
          ? '<c' + attrs + '><v>' + val + '</v></c>'
          : '<c' + attrs + ' t="inlineStr"><is><t xml:space="preserve">' + xml(val) + '</t></is></c>'
      }).join('') + '</row>'
    }).join('') + '</sheetData></worksheet>'
}
function makeXlsx(sheets: Sheet[]): Uint8Array {
  const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.'
  const parts = [
    { name: '[Content_Types].xml', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="' + type + 'sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="' + type + 'styles+xml"/>' + sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="' + type + 'worksheet+xml"/>').join('') + '</Types>') },
    { name: '_rels/.rels', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
    { name: 'xl/workbook.xml', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((s, i) => '<sheet name="' + xml(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>') },
    { name: 'xl/_rels/workbook.xml.rels', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>') },
    { name: 'xl/styles.xml', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173A63"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>') },
    ...sheets.map((sheet, i) => ({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: enc(worksheet(sheet.rows)) })),
  ]
  return zip(parts)
}
function downloadExcel(name: string, sheets: Sheet[]) {
  const bytes = makeXlsx(sheets)
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob), anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 15000)
}
const headings = ['No', 'Tanggal', 'Judul / kegiatan', 'Sasaran', 'Bidang', 'Status']
const dateDisplay = (d: string) => dateLabel(d)

export default function BkServiceReports({ records, school, academicYear, requestedKind }: {
  records: RecordItem[]; school: string; academicYear: string; requestedKind: string
}) {
  const [kind, setKind] = useState(requestedKind || 'all')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [status, setStatus] = useState('all')
  useEffect(() => setKind(requestedKind || 'all'), [requestedKind])
  const eligible = useMemo(() => records.filter(r =>
    !r.confidential && serviceReportModules.some(m => m.key === r.kind)
  ), [records])
  const statuses = useMemo(() => Array.from(new Set(eligible.map(r => r.status))).filter(Boolean).sort(), [eligible])
  const invalidDates = Boolean(start && end && start > end)
  const rows = useMemo(() => invalidDates ? [] : eligible.filter(r =>
    (kind === 'all' || r.kind === kind) &&
    (!start || r.happened_on >= start) && (!end || r.happened_on <= end) &&
    (status === 'all' || r.status === status)
  ).map(safeItem).sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title, 'id')), [eligible, kind, start, end, status, invalidDates])
  const modules = serviceReportModules.filter(m => kind === 'all' || kind === m.key)
  const complete = rows.filter(r => r.status === 'Selesai').length
  const planned = rows.filter(r => r.status === 'Terencana').length
  const other = rows.length - complete - planned
  const period = (start ? dateDisplay(start) : 'Awal data') + ' s.d. ' + (end ? dateDisplay(end) : 'Akhir data')
  const generated = dateDisplay(today())
  const selectedLabel = modules.length === 1 ? modules[0].label : 'Seluruh Layanan & Program'
  const exportWorkbook = () => {
    const sheets: Sheet[] = [{
      name: 'Rekap',
      rows: [
        ['LAPORAN LAYANAN & PROGRAM BK'], ['Sekolah', school], ['Tahun ajaran', academicYear],
        ['Periode', period], ['Jenis laporan', selectedLabel], ['Status', status === 'all' ? 'Semua status' : status],
        ['Tanggal dibuat', generated], [],
        ['Jenis layanan', 'Jumlah kegiatan', 'Selesai', 'Terencana', 'Lainnya'],
        ...modules.map(m => {
          const section = rows.filter(r => r.kind === m.key)
          return [m.label, section.length, section.filter(r => r.status === 'Selesai').length, section.filter(r => r.status === 'Terencana').length, section.filter(r => r.status !== 'Selesai' && r.status !== 'Terencana').length]
        }),
        ['TOTAL', rows.length, complete, planned, other],
        [], ['Keterangan', 'Data rahasia, nama/NIS peserta, tautan dokumen, dan catatan konseling tidak diekspor.'],
      ],
    }]
    for (const m of modules) {
      const section = rows.filter(r => r.kind === m.key)
      const columns = m.fields.map(f => f[0])
      const header = [...headings, ...columns]
      sheets.push({
        name: m.label,
        rows: [
          ['LAPORAN ' + m.label.toUpperCase()], ['Sekolah', school], ['Tahun ajaran', academicYear],
          ['Periode', period], ['Jumlah kegiatan', section.length], [],
          header,
          ...section.map((r, i) => [
            i + 1, dateDisplay(r.date), r.title, r.target, r.domain, r.status,
            ...columns.map(label => r.details[label] || '—'),
          ]),
          [], ['TOTAL KEGIATAN', section.length],
        ],
      })
    }
    downloadExcel('Laporan-BK-' + slug(kind) + '-' + today() + '.xlsx', sheets)
  }
  return <section className="bk-service-report">
    <header className="bk-report-controls">
      <div><span className="small-tag">REKAP ADMINISTRASI SEKOLAH</span><h1>Laporan Layanan & Program BK</h1><p>Siap dicetak, disimpan sebagai PDF, atau diunduh dalam Excel (.xlsx) dengan 7 sheet kegiatan.</p></div>
      <div className="bk-report-actions">
        <button type="button" className="btn secondary" disabled={invalidDates} onClick={exportWorkbook}><FileSpreadsheet size={17}/> Unduh Excel</button>
        <button type="button" className="btn primary" disabled={invalidDates} onClick={() => window.print()}><FileText size={17}/> Cetak / simpan PDF</button>
      </div>
    </header>
    <div className="panel bk-report-filters bk-report-controls">
      <label>Jenis laporan<select value={kind} onChange={e => setKind(e.target.value)}><option value="all">Semua layanan & program</option>{serviceReportModules.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select></label>
      <label>Dari tanggal<input type="date" value={start} onChange={e => setStart(e.target.value)}/></label>
      <label>Sampai tanggal<input type="date" value={end} onChange={e => setEnd(e.target.value)}/></label>
      <label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">Semua status</option>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
      <button type="button" className="btn secondary" onClick={() => { setKind('all'); setStart(''); setEnd(''); setStatus('all') }}>Reset filter</button>
    </div>
    {invalidDates && <p className="bk-report-warning" role="alert">Tanggal awal tidak boleh melebihi tanggal akhir.</p>}
    <div className="bk-report-print">
      <div className="bk-report-cover">
        <div className="bk-report-brand"><img src="/bantu-beres-logo.png" alt="Logo BK Pro"/><div><small>BUKU LAPORAN BIMBINGAN & KONSELING</small><h2>Laporan Layanan & Program BK</h2><p>{school}</p></div></div>
        <div className="bk-report-meta"><span>Tahun ajaran <b>{academicYear}</b></span><span>Periode <b>{period}</b></span><span>Disusun <b>{generated}</b></span></div>
      </div>
      <div className="bk-report-stats"><div><span>Jumlah kegiatan</span><strong>{rows.length}</strong></div><div><span>Selesai</span><strong>{complete}</strong></div><div><span>Terencana</span><strong>{planned}</strong></div><div><span>Status lainnya</span><strong>{other}</strong></div></div>
      <h3>Ringkasan kegiatan</h3>
      <div className="bk-report-table-wrap"><table className="bk-report-table"><thead><tr><th>Jenis layanan</th><th>Total</th><th>Selesai</th><th>Terencana</th><th>Lainnya</th></tr></thead><tbody>{modules.map(m => {
        const section = rows.filter(r => r.kind === m.key)
        return <tr key={m.key}><td>{m.label}</td><td>{section.length}</td><td>{section.filter(r => r.status === 'Selesai').length}</td><td>{section.filter(r => r.status === 'Terencana').length}</td><td>{section.filter(r => r.status !== 'Selesai' && r.status !== 'Terencana').length}</td></tr>
      })}<tr className="bk-report-total"><td>Total</td><td>{rows.length}</td><td>{complete}</td><td>{planned}</td><td>{other}</td></tr></tbody></table></div>
      {modules.map(m => {
        const section = rows.filter(r => r.kind === m.key)
        return <section key={m.key} className="bk-report-section">
          <div className="bk-report-section-heading"><h3>{m.label}</h3><span>{section.length} kegiatan</span></div>
          {section.length ? <div className="bk-report-table-wrap"><table className="bk-report-table"><thead><tr><th>No.</th><th>Tanggal</th><th>Judul / kegiatan</th><th>Sasaran</th><th>Bidang</th><th>Status</th><th>Informasi kegiatan</th></tr></thead><tbody>{section.map((r, i) => <tr key={r.id}><td>{i + 1}</td><td>{dateDisplay(r.date)}</td><td>{r.title}</td><td>{r.target}</td><td>{r.domain}</td><td>{r.status}</td><td>{Object.entries(r.details).map(([label, value]) => label + ': ' + value).join(' · ') || '—'}</td></tr>)}</tbody></table></div> : <p className="bk-report-none">Tidak ada kegiatan pada periode dan filter yang dipilih.</p>}
        </section>
      })}
      <p className="bk-report-privacy"><LockKeyhole size={14}/> Laporan administratif sekolah. Data individu, NIS, daftar peserta, isi sesi rahasia, dan tautan dokumen tidak disertakan.</p>
      <div className="bk-report-signatures"><div><p>Mengetahui,</p><strong>Kepala Sekolah</strong><div className="bk-sign-line">Nama / NIP: ..................................</div></div><div><p>Disusun oleh,</p><strong>Guru Bimbingan & Konseling</strong><div className="bk-sign-line">Nama / NIP: ..................................</div></div></div>
    </div>
    <p className="bk-report-notice bk-report-controls"><LockKeyhole size={15}/> Laporan tidak menyertakan catatan rahasia atau identitas siswa. Data hanya diambil dari sekolah yang sedang dipilih.</p>
    <div className="bk-report-help bk-report-controls"><Download size={15}/> PDF: pilih “Cetak / simpan PDF”, kemudian simpan sebagai PDF. Excel: file .xlsx langsung terunduh dengan ringkasan dan sheet per menu.</div>
  </section>
}
