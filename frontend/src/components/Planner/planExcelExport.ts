import type { BomTreeNode, PlanResponse } from '../../types';

interface ExportRow {
  occupation: string;
  floors: Set<number>;
  type: 'วัตถุดิบดิบ' | 'สินค้าแปรรูป';
  itemId: string;
  itemName: string;
  needed: number;
}

const stacks = (quantity: number) => Math.ceil(Math.max(0, quantity) / 99);

function addBomRows(
  node: BomTreeNode,
  occupation: string,
  floorNumber: number,
  rows: Map<string, ExportRow>,
  isRoot = true,
) {
  if (!isRoot) {
    const type = node.is_raw ? 'วัตถุดิบดิบ' : 'สินค้าแปรรูป';
    const key = `${occupation}\u0000${type}\u0000${node.item_id}`;
    const current = rows.get(key) ?? {
      occupation,
      floors: new Set<number>(),
      type,
      itemId: node.item_id,
      itemName: node.item_name,
      needed: 0,
    };
    current.floors.add(floorNumber);
    current.needed += node.quantity_needed;
    rows.set(key, current);
  }
  node.children.forEach((child) => addBomRows(child, occupation, floorNumber, rows, false));
}

function sheetName(label: string, count: number) {
  return `${label} (${count})`.slice(0, 31);
}

function setSheetLayout(sheet: import('xlsx').WorkSheet, widths: number[], headerRow: number, lastColumn: string, lastRow: number) {
  sheet['!cols'] = widths.map((wch) => ({ wch }));
  sheet['!autofilter'] = { ref: `A${headerRow}:${lastColumn}${Math.max(headerRow, lastRow)}` };
  sheet['!rows'] = [{ hpt: 26 }, { hpt: 20 }, { hpt: 8 }, { hpt: 22 }];
}

/** Export the current calculated plan as a three-sheet Excel workbook. */
export async function exportPlanToExcel(result: PlanResponse, occupationByFloor: Record<number, string>) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const generatedAt = new Date();

  const occupationRows = new Map<string, ExportRow>();
  result.floor_results.forEach((floor) => {
    const occupation = occupationByFloor[floor.floor_number] || 'ยังไม่ระบุอาชีพ';
    addBomRows(floor.bom_tree, occupation, floor.floor_number, occupationRows);
  });
  const occupationList = [...occupationRows.values()].sort((a, b) =>
    a.occupation.localeCompare(b.occupation, 'th') || a.type.localeCompare(b.type, 'th') || a.itemName.localeCompare(b.itemName, 'th'));
  const occupationCount = new Set(result.floor_results.map((floor) => occupationByFloor[floor.floor_number] || 'ยังไม่ระบุอาชีพ')).size;
  // Stock is shared by all occupations. Keep this sheet as gross demand so the
  // same stock is not deducted once per occupation; global shortages live in
  // the raw and processed sheets.
  const occupationData = occupationList.map((row) => [
    row.occupation,
    [...row.floors].sort((a, b) => a - b).join(', '),
    row.type,
    row.itemName,
    row.needed,
    stacks(row.needed),
  ]);
  const occupationSheet = XLSX.utils.aoa_to_sheet([
    ['แผนการผลิตแยกตามอาชีพ'],
    [`ระยะเวลา Event ${result.event_total_hours.toLocaleString('th-TH')} ชั่วโมง`, `สร้างเมื่อ ${generatedAt.toLocaleString('th-TH')}`],
    [],
    ['อาชีพ', 'ชั้น', 'ประเภท', 'รายการ', 'ต้องใช้', 'กองที่ต้องใช้ (÷99)'],
    ...occupationData,
  ]);
  setSheetLayout(occupationSheet, [18, 14, 18, 34, 14, 20], 4, 'F', occupationData.length + 4);
  XLSX.utils.book_append_sheet(workbook, occupationSheet, sheetName('แยกอาชีพ', occupationCount));

  const rawData = [...result.raw_materials]
    .sort((a, b) => b.net_required - a.net_required || a.item_name.localeCompare(b.item_name, 'th'))
    .map((item) => [item.item_name, item.total_needed, item.in_stock, item.net_required,
      stacks(item.total_needed), stacks(item.net_required), item.sufficient ? 'เพียงพอ' : 'ต้องหาเพิ่ม']);
  const rawSheet = XLSX.utils.aoa_to_sheet([
    ['วัตถุดิบดิบทั้งหมด'],
    [`ระยะเวลา Event ${result.event_total_hours.toLocaleString('th-TH')} ชั่วโมง`, `สร้างเมื่อ ${generatedAt.toLocaleString('th-TH')}`],
    [],
    ['รายการ', 'ต้องใช้', 'ในสต็อก', 'จัดหาเพิ่ม', 'กองที่ต้องใช้ (÷99)', 'กองที่ต้องหาเพิ่ม', 'สถานะ'],
    ...rawData,
  ]);
  setSheetLayout(rawSheet, [36, 14, 14, 14, 20, 20, 16], 4, 'G', rawData.length + 4);
  XLSX.utils.book_append_sheet(workbook, rawSheet, sheetName('วัตถุดิบดิบ', rawData.length));

  const intermediateData = [...result.intermediate_supply]
    .sort((a, b) => b.shortfall - a.shortfall || a.item_name.localeCompare(b.item_name, 'th'))
    .map((item) => [item.item_name, item.needed, item.produced, item.shortfall,
      stacks(item.needed), stacks(item.shortfall), item.sufficient ? 'เพียงพอ' : 'ต้องผลิตเพิ่ม']);
  const intermediateSheet = XLSX.utils.aoa_to_sheet([
    ['สินค้าแปรรูปทั้งหมด'],
    [`ระยะเวลา Event ${result.event_total_hours.toLocaleString('th-TH')} ชั่วโมง`, `สร้างเมื่อ ${generatedAt.toLocaleString('th-TH')}`],
    [],
    ['รายการ', 'ต้องใช้', 'ผลิตในแผน', 'ยังขาด', 'กองที่ต้องใช้ (÷99)', 'กองที่ต้องผลิตเพิ่ม', 'สถานะ'],
    ...intermediateData,
  ]);
  setSheetLayout(intermediateSheet, [36, 14, 16, 14, 20, 22, 16], 4, 'G', intermediateData.length + 4);
  XLSX.utils.book_append_sheet(workbook, intermediateSheet, sheetName('สินค้าแปรรูป', intermediateData.length));

  XLSX.writeFile(workbook, `แผนการผลิต-${generatedAt.toISOString().slice(0, 10)}.xlsx`, { compression: true });
}
