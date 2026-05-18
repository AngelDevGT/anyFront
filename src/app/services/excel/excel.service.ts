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
        const dataRows: any[][] = tableRows.map((row: any[]) =>
            textCells(row).map((cell: any) => cell.exportValue ?? cell.value ?? '')
        );
        const formats: (string | undefined)[][] = tableRows.map((row: any[]) =>
            textCells(row).map((cell: any) => cell.exportFormat)
        );

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
        this.applyStyles(XLSX, worksheet, formats);
        worksheet['!cols'] = this.computeColumnWidths(headers, dataRows, formats);
        worksheet['!autofilter'] = { ref: worksheet['!ref']! };

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');
        XLSX.writeFile(workbook, this.buildFileName(fileName));
    }

    private applyStyles(XLSX: any, worksheet: any, formats: (string | undefined)[][]): void {
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let R = range.s.r; R <= range.e.r; R++) {
            for (let C = range.s.c; C <= range.e.c; C++) {
                const addr = XLSX.utils.encode_cell({ r: R, c: C });
                if (!worksheet[addr]) continue;
                this.styleCell(worksheet[addr], R, C, formats);
            }
        }
    }

    private styleCell(cell: any, row: number, col: number, formats: (string | undefined)[][]): void {
        if (row === 0) {
            cell.s = HEADER_STYLE;
            return;
        }
        cell.s = row % 2 === 0 ? ROW_ALT_STYLE : ROW_STYLE;
        const fmt = formats[row - 1]?.[col];
        if (fmt) cell.z = fmt;
    }

    private computeColumnWidths(headers: string[], dataRows: any[][], formats: (string | undefined)[][]) {
        return headers.map((h, i) => {
            const maxData = Math.max(0, ...dataRows.map(row => String(row[i] ?? '').length));
            const maxFmt = Math.max(0, ...formats.map(row => (row[i]?.length ?? 0)));
            return { wch: Math.max(h.length, maxData, maxFmt) + 4 };
        });
    }

    private buildFileName(base: string): string {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        return `${base.replaceAll(' ', '_')}_${timestamp}.xlsx`;
    }
}
