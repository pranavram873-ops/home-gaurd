'use client';

import React, { useState } from 'react';
import { addRosterGuards } from '@/lib/services/simpleAttendanceService';
import { Icon } from '@/components/ui/Icon';

interface ImportRow {
  full_name: string;
  phone: string;
  home_guard_code: string;
  date_of_birth: string;
  joining_date: string;
}

interface HomeGuardExcelImportProps {
  divisionId: string;
  divisionName: string;
  onClose: () => void;
  onImported: () => void;
}

function normalizeHeader(value: string) {
  return value.toLocaleLowerCase('en-IN').replace(/[^a-z0-9]/g, '');
}

function getCell(row: Record<string, unknown>, aliases: string[]): unknown {
  const cells = new Map(
    Object.entries(row).map(([header, value]) => [normalizeHeader(header), value]),
  );
  for (const alias of aliases) {
    const value = cells.get(alias);
    if (value !== undefined) return value;
  }
  return '';
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function formatDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const serialDay = Math.floor(value);
    const base = Date.UTC(1899, 11, serialDay >= 60 ? 30 : 31);
    const date = new Date(base + serialDay * 24 * 60 * 60 * 1000);
    return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  const text = cellText(value);
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(text);
  if (iso) return formatDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const local = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  if (local) return formatDate(Number(local[3]), Number(local[2]), Number(local[1]));
  return null;
}

async function parseWorkbook(file: File): Promise<{ rows: ImportRow[]; errors: string[] }> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('The workbook does not contain a worksheet.');

  const headerRow = worksheet.getRow(1);
  const headers = Array.from({ length: headerRow.cellCount }, (_, index) => headerRow.getCell(index + 1).text.trim());
  if (!headers.some(Boolean)) throw new Error('The first row must contain the spreadsheet column headers.');
  const sourceRows: Array<{ rowNumber: number; source: Record<string, unknown> }> = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const source: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      const cell = row.getCell(index + 1);
      const value = cell.value;
      source[header] = value && typeof value === 'object' && !(value instanceof Date) ? cell.text : value;
    });
    sourceRows.push({ rowNumber, source });
  });
  if (!sourceRows.length) throw new Error('The worksheet does not contain any Home Guard rows.');

  const requiredHeaders = [
    ['Full Name', ['fullname', 'name', 'guardname', 'homeguardname']],
    ['Phone', ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contactnumber']],
    ['Home Guard Code', ['homeguardcode', 'homeguardnumber', 'homeguardid', 'guardcode', 'personnelid', 'badgeid', 'badgecode', 'hgcode', 'code']],
    ['Date of Birth', ['dateofbirth', 'dob']],
    ['Joining Date', ['joiningdate', 'dateofjoining', 'datejoined']],
  ] as const;
  const firstRowHeaders = new Set(Object.keys(sourceRows[0]).map(normalizeHeader));
  const missingHeaders = requiredHeaders
    .filter(([, aliases]) => !aliases.some((alias) => firstRowHeaders.has(alias)))
    .map(([label]) => label);
  if (missingHeaders.length) {
    throw new Error(`Missing columns: ${missingHeaders.join(', ')}. Use the template or add these headers to the first row.`);
  }

  const rows: ImportRow[] = [];
  const errors: string[] = [];
  const codes = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);

  sourceRows.forEach(({ source, rowNumber }) => {
    if (Object.values(source).every((value) => cellText(value) === '')) return;
    const fullName = cellText(getCell(source, ['fullname', 'name', 'guardname', 'homeguardname']));
    const phoneValue = getCell(source, ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contactnumber']);
    const phone = typeof phoneValue === 'number' && Number.isSafeInteger(phoneValue)
      ? String(phoneValue)
      : cellText(phoneValue).replace(/\D/g, '');
    const homeGuardCode = cellText(getCell(source, [
      'homeguardcode', 'homeguardnumber', 'homeguardid', 'guardcode',
      'personnelid', 'badgeid', 'badgecode', 'hgcode', 'code',
    ])).toUpperCase();
    const dateOfBirth = parseDate(getCell(source, ['dateofbirth', 'dob']));
    const joiningDate = parseDate(getCell(source, ['joiningdate', 'dateofjoining', 'datejoined']));
    const problems: string[] = [];

    if (fullName.length < 3 || fullName.length > 120) problems.push('name must be 3–120 characters');
    if (!/^\d{10}$/.test(phone)) problems.push('phone must be a 10-digit number');
    if (!/^(WHG|HG)[A-Z0-9-]+$/.test(homeGuardCode) || homeGuardCode.length > 40) {
      problems.push('code must start with HG or WHG');
    } else if (codes.has(homeGuardCode)) {
      problems.push('code is duplicated in this file');
    } else {
      codes.add(homeGuardCode);
    }
    if (!dateOfBirth) problems.push('date of birth is invalid');
    if (!joiningDate) problems.push('joining date is invalid');
    if (dateOfBirth && dateOfBirth > today) problems.push('date of birth cannot be in the future');
    if (joiningDate && joiningDate > today) problems.push('joining date cannot be in the future');
    if (dateOfBirth && joiningDate && joiningDate < dateOfBirth) {
      problems.push('joining date cannot be before date of birth');
    }

    if (problems.length) {
      errors.push(`Row ${rowNumber}: ${problems.join('; ')}`);
      return;
    }
    rows.push({
      full_name: fullName,
      phone,
      home_guard_code: homeGuardCode,
      date_of_birth: dateOfBirth!,
      joining_date: joiningDate!,
    });
  });

  if (!rows.length && !errors.length) {
    errors.push('Add at least one Home Guard row below the header.');
  }
  return { rows, errors };
}

async function downloadTemplate() {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Home Guards');
  worksheet.addRow([
    'Full Name',
    'Home Guard Code',
    'Phone',
    'Division',
    'Date of Birth',
    'Joining Date',
  ]);
  worksheet.columns = [
    { width: 28 },
    { width: 22 },
    { width: 16, numFmt: '@' },
    { width: 24 },
    { width: 18, numFmt: 'dd/mm/yyyy' },
    { width: 18, numFmt: 'dd/mm/yyyy' },
  ];

  const instructions = workbook.addWorksheet('Instructions');
  instructions.addRows([
    ['Home Guard spreadsheet import'],
    ['Add one Home Guard per row on the Home Guards sheet.'],
    ['All six columns are required. Keep the header row unchanged.'],
    ['Phone numbers must contain 10 digits. Format the Phone column as Text to preserve leading zeroes.'],
    ['Dates may be Excel dates or YYYY-MM-DD / DD-MM-YYYY values.'],
    ['This file will be imported into the division selected on the Guards page.'],
  ]);
  instructions.getColumn(1).width = 100;

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer]));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'home-guard-import-template.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function HomeGuardExcelImport({
  divisionId,
  divisionName,
  onClose,
  onImported,
}: HomeGuardExcelImportProps) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [rowErrors, setRowErrors] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setRows([]);
    setRowErrors([]);
    setImportedCount(null);
    setFileError(null);
    if (!file) return;

    setFileName(file.name);
    setReading(true);
    try {
      const parsed = await parseWorkbook(file);
      setRows(parsed.rows);
      setRowErrors(parsed.errors);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'The Excel file could not be read.');
    } finally {
      setReading(false);
    }
  }

  async function handleImport() {
    if (!divisionId || !rows.length || rowErrors.length) return;
    setImporting(true);
    setFileError(null);
    try {
      await addRosterGuards(rows.map((row) => ({ ...row, division_id: divisionId })));
      onImported();
      setImportedCount(rows.length);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'The Home Guards could not be imported.');
    } finally {
      setImporting(false);
    }
  }

  async function handleDownloadTemplate() {
    setDownloadingTemplate(true);
    setFileError(null);
    try {
      await downloadTemplate();
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'The import template could not be downloaded.');
    } finally {
      setDownloadingTemplate(false);
    }
  }

  return (
    <div className="overlay-enter fixed inset-0 z-[70] flex items-center justify-center bg-surface-container/40 p-4 backdrop-blur-xs">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-guard-import-title"
        className="overlay-panel flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-2xl"
      >
        <div className="flex items-center justify-between bg-primary p-4 text-on-primary">
          <div className="flex items-center gap-2">
            <Icon icon="upload_file" size={20} />
            <h2 id="home-guard-import-title" className="text-sm font-bold">
              {importedCount === null ? 'Bulk add Home Guards' : 'Import complete'}
            </h2>
          </div>
          <button type="button" onClick={onClose} disabled={importing} aria-label="Close import dialog">
            <Icon icon="close" size={20} />
          </button>
        </div>

        {importedCount !== null ? (
          <div className="flex flex-col gap-4 p-5 text-sm">
            <p role="status" className="rounded-lg bg-tertiary-fixed p-3 font-semibold text-on-tertiary-fixed-variant">
              {importedCount} Home Guard{importedCount === 1 ? '' : 's'} added to {divisionName}.
            </p>
            <button type="button" onClick={onClose} className="self-end rounded-lg bg-primary px-4 py-2 font-bold text-on-primary">
              Done
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5 text-sm">
            <p className="text-on-surface-variant">
              Choose an Excel file to add multiple Home Guards to <strong className="text-on-surface">{divisionName}</strong>.
              Each row needs a name, 10-digit phone, HG/WHG code, date of birth, and joining date.
            </p>
            <p className="rounded-lg bg-surface-container-low p-3 text-xs text-on-surface-variant">
              This adds roster records for the selected division; it does not create sign-in accounts.
            </p>

            <button
              type="button"
              onClick={() => void handleDownloadTemplate()}
              disabled={downloadingTemplate}
              className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg bg-surface-container px-3 font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-60"
            >
              <Icon icon={downloadingTemplate ? 'sync' : 'download'} size={18} className={downloadingTemplate ? 'animate-spin' : ''} />
              Download Excel template
            </button>

            <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low p-4 text-center hover:border-primary">
              <Icon icon="table_view" size={24} className="text-primary" />
              <span className="font-semibold text-on-surface">{fileName || 'Choose an .xlsx file'}</span>
              <span className="text-xs text-on-surface-variant">Excel workbook (.xlsx)</span>
              <input
                type="file"
                accept=".xlsx"
                aria-label="Choose Home Guard Excel file"
                onChange={(event) => void handleFileChange(event)}
                className="sr-only"
              />
            </label>

            {reading && <p role="status" className="text-xs text-on-surface-variant">Reading spreadsheet…</p>}
            {rows.length > 0 && (
              <p className="rounded-lg bg-surface-container-low p-3 text-xs font-semibold text-on-surface">
                {rows.length} valid Home Guard row{rows.length === 1 ? '' : 's'} ready to import.
              </p>
            )}
            {rowErrors.length > 0 && (
              <div role="alert" className="max-h-36 overflow-y-auto rounded-lg bg-error-container p-3 text-xs text-on-error-container">
                <p className="mb-1 font-bold">Fix these spreadsheet rows before importing:</p>
                <ul className="list-inside list-disc space-y-1">
                  {rowErrors.slice(0, 8).map((error) => <li key={error}>{error}</li>)}
                </ul>
                {rowErrors.length > 8 && <p className="mt-1">And {rowErrors.length - 8} more row errors.</p>}
              </div>
            )}
            {fileError && (
              <p role="alert" className="rounded-lg bg-error-container p-3 text-xs font-semibold text-on-error-container">
                {fileError}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-outline-variant pt-3">
              <button
                type="button"
                onClick={onClose}
                disabled={importing}
                className="rounded-lg bg-surface-container px-4 py-2 font-semibold text-on-surface-variant disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={importing || reading || !rows.length || rowErrors.length > 0}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing && <Icon icon="sync" size={16} className="animate-spin" />}
                {importing ? 'Importing…' : `Import ${rows.length || ''} Home Guards`}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
