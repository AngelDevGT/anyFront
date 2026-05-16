import { Injectable } from '@angular/core';

const HEADER_STYLE = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: '198754' } },
    alignment: { horizontal: 'center' },
    border: {
        top:    { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left:   { style: 'thin', color: { rgb: '000000' } },
        right:  { style: 'thin', color: { rgb: '000000' } },
    }
};

const ROW_STYLE = {
    border: {
        top:    { style: 'thin', color: { rgb: 'CCCCCC' } },
        bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
        left:   { style: 'thin', color: { rgb: 'CCCCCC' } },
        right:  { style: 'thin', color: { rgb: 'CCCCCC' } },
    }
};

const ROW_ALT_STYLE = {
    ...ROW_STYLE,
    fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } },
};

@Injectable({ providedIn: 'root' })
export class ExcelService {

    async exportTableToExcel(tableRows: any[][], fileName: string): Promise<void> {
        if (!tableRows?.length) return;

        const XLSX = await import('xlsx-js-style');

        const textCells = (row: any[]) => row.filter((cell: any) => cell.type === 'text');

        const headers: string[] = textCells(tableRows[0]).map((cell: any) => cell.header_name);
        const dataRows: string[][] = tableRows.map((row: any[]) =>
            textCells(row).map((cell: any) => cell.value ?? '')
        );

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

        const range = XLSX.utils.decode_range(worksheet['!ref']!);
        for (let R = range.s.r; R <= range.e.r; R++) {
            for (let C = range.s.c; C <= range.e.c; C++) {
                const addr = XLSX.utils.encode_cell({ r: R, c: C });
                if (!worksheet[addr]) continue;
                if (R === 0) {
                    worksheet[addr].s = HEADER_STYLE;
                } else {
                    worksheet[addr].s = R % 2 === 0 ? ROW_ALT_STYLE : ROW_STYLE;
                }
            }
        }

        worksheet['!cols'] = headers.map((h, i) => ({
            wch: Math.max(h.length, ...dataRows.map(row => String(row[i] ?? '').length)) + 4
        }));

        worksheet['!autofilter'] = { ref: worksheet['!ref']! };

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');

        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const safeFileName = `${fileName.replaceAll(' ', '_')}_${timestamp}.xlsx`;
        XLSX.writeFile(workbook, safeFileName);
    }
}
