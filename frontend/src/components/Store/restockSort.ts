export type RestockSort = { key: 'name' | 'stock' | 'status' | 'qty'; order: 'ascend' | 'descend' };
export const defaultRestockSort: RestockSort = { key: 'name', order: 'ascend' };
type Product = { item_id: string; name: string; stock: number };
export function compareProductNames(a: {name:string}, b: {name:string}) {
  const isThai = (name:string) => /^[\u0E00-\u0E7F]/.test(name.trim());
  return Number(isThai(a.name)) - Number(isThai(b.name)) || a.name.trim().localeCompare(b.name.trim(), ['th','en'], {numeric:true,sensitivity:'base'});
}
export function sortRestockProducts<T extends Product>(products:T[], sort:RestockSort, quantities:Record<string,number>):T[] {
  return [...products].sort((a,b)=>{
    const primary = sort.key==='name' ? compareProductNames(a,b)
      : sort.key==='stock' ? a.stock-b.stock
      : sort.key==='status' ? Number(a.stock>0)-Number(b.stock>0)
      : (quantities[a.item_id]??0)-(quantities[b.item_id]??0);
    return primary*(sort.order==='ascend'?1:-1) || compareProductNames(a,b) || a.item_id.localeCompare(b.item_id);
  });
}
