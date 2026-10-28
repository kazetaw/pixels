import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, Modal, Popconfirm, Segmented, Select, Spin, Tag, Tooltip, message } from 'antd';
import { CameraOutlined, DeleteOutlined, EditOutlined, MailOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { toPngBlob } from './profileImage';
import './StoreAccounts.css';
type Character = {name:string;id:string;category:'มอน/ป่า'|'คราฟ';items:string[];avatar:number;image_url:string|null};
type Account = {key?:string;email:string;characters:Character[];updated_at?:string};
const blank = ():Account => ({email:'',characters:Array.from({length:3},(_,i)=>({name:'',id:'',category:'มอน/ป่า',items:[],avatar:i,image_url:null}))});
function Avatar({character}:{character:Character}) {
  const [broken,setBroken]=useState(false);
  useEffect(()=>setBroken(false),[character.image_url]);
  return character.image_url && !broken ? <img className="account-avatar" src={character.image_url} alt={character.name || 'ตัวละคร'} onError={()=>setBroken(true)} />
    : <span role="img" aria-label={`Avatar ${character.avatar+1}`} className="account-avatar account-avatar--pixel" style={{backgroundPosition:`${(character.avatar%3)*50}% ${Math.floor(character.avatar/3)*100}%`}} />;
}
export function StoreAccounts({storeId,itemNames}:{storeId:string;itemNames:string[]}) {
 const [accounts,setAccounts]=useState<Account[]>([]);
 const [loading,setLoading]=useState(true);
 const [loadError,setLoadError]=useState('');
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState('ทั้งหมด');
 const [draft,setDraft]=useState<Account|null>(null);
 const [saving,setSaving]=useState(false);
 const [uploading,setUploading]=useState<number|null>(null);
 const [error,setError]=useState('');
 const [msg,context]=message.useMessage();
 const base=`/api/store/${storeId}/accounts`;
 const load=async()=>{
  setLoading(true);setLoadError('');
  try{const r=await fetch(base);const data=await r.json();if(!r.ok)throw new Error(data.error||'โหลดสมุดบัญชีไม่สำเร็จ');setAccounts(data);}
  catch(e){setLoadError((e as Error).message);}finally{setLoading(false);}
 };
 useEffect(()=>{void load();},[storeId]);
 const edit=(account?:Account)=>{setDraft(account?{...account,characters:account.characters.map(c=>({...c,items:[...c.items]}))}:blank());setError('');};
 const change=(i:number,patch:Partial<Character>)=>setDraft(d=>d&&({...d,characters:d.characters.map((c,j)=>i===j?{...c,...patch}:c)}));
 const save=async()=>{
  if(!draft||saving||uploading!==null)return;
  if(!/^[^\s@]+@gmail\.com$/i.test(draft.email.trim())){setError('กรอก Gmail ให้ถูกต้อง เช่น name@gmail.com');return;}
  if(draft.characters.some(c=>!c.name.trim()||!c.id.trim()||!c.items.length)){setError('กรอกชื่อ ID และของที่เก็บให้ครบทั้ง 3 ตัวละคร');return;}
  if(new Set(draft.characters.map(c=>c.id.trim())).size!==3){setError('ID ทั้ง 3 ตัวต้องไม่ซ้ำกัน');return;}
  setSaving(true);setError('');
  try{const r=await fetch(draft.key?`${base}/${draft.key}`:base,{method:draft.key?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
   const data=await r.json();if(!r.ok)throw new Error(data.error||'บันทึกไม่สำเร็จ');
   setAccounts(a=>[...a.filter(v=>v.key!==data.key),data].sort((a,b)=>a.email.localeCompare(b.email)));setDraft(null);void msg.success('บันทึกสมุดบัญชีแล้ว');
  }catch(e){setError((e as Error).message);}finally{setSaving(false);}
 };
 const upload=async(i:number,file:File|undefined)=>{
  if(!file||uploading!==null)return;
  if(!file.type.startsWith('image/')||file.size>10*1024*1024){setError('เลือกรูปภาพขนาดไม่เกิน 10 MB');return;}
  setUploading(i);setError('');
  try{const form=new FormData();form.append('bucket','images');form.append('folder','characters');form.append('itemId',`${storeId}-${crypto.randomUUID()}`);form.append('file',await toPngBlob(file),'avatar.png');
   const r=await fetch('/api/upload-image',{method:'POST',body:form});const data=await r.json();if(!r.ok||!data.url)throw new Error(data.error||'อัปโหลดไม่สำเร็จ');change(i,{image_url:data.url});
  }catch(e){setError((e as Error).message);}finally{setUploading(null);}
 };
 const remove=async(account:Account)=>{
  const r=await fetch(`${base}/${account.key}`,{method:'DELETE'});if(!r.ok)throw new Error('ลบไม่สำเร็จ');setAccounts(a=>a.filter(v=>v.key!==account.key));void msg.success('ลบบัญชีแล้ว');
 };
 const q=query.trim().toLowerCase();
 const visible=accounts.map(a=>({...a,characters:a.characters.filter(c=>(filter==='ทั้งหมด'||filter===c.category)&&[a.email,c.name,c.id,...c.items].join(' ').toLowerCase().includes(q))})).filter(a=>a.characters.length);
 return <section className="accounts">{context}
  <div className="accounts-tools"><Input prefix={<SearchOutlined />} value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหา Gmail, ตัวละคร, ID หรือของที่เก็บ" allowClear aria-label="ค้นหาสมุดบัญชี" />
   <Segmented value={filter} onChange={setFilter} options={['ทั้งหมด','มอน/ป่า','คราฟ']} />
   <Button type="primary" icon={<PlusOutlined />} onClick={()=>edit()}>เพิ่ม Gmail</Button>
  </div>
  <div className="accounts-caption"><span>{accounts.length} Gmail · {accounts.length*3} ตัวละคร</span><span>1 Gmail มี 3 ตัวละคร · แต่ละตัวเก็บของได้หลายอย่าง</span></div>
  {loadError&&<Alert type="error" showIcon title={loadError} action={<Button onClick={()=>void load()}>ลองใหม่</Button>} />}
  {loading?<div className="accounts-loading"><Spin /></div>:!loadError&&<>
   {visible.map(a=><section className="account-group" key={a.key}>
    <header><div><MailOutlined /><strong>{a.email}</strong><Tag color="blue">3 ตัวละคร</Tag></div><Button type="text" icon={<EditOutlined />} onClick={()=>edit(accounts.find(v=>v.key===a.key))}>แก้ไข</Button></header>
    <div className="account-scroll"><table><thead><tr><th>ตัวละคร</th><th>ID ตัวละคร</th><th>หมวด</th><th>ของที่เก็บ</th><th>จัดการ</th></tr></thead>
     <tbody>{a.characters.map(c=><tr key={c.id}><td><div className="account-person"><Avatar character={c}/><strong>{c.name}</strong></div></td><td className="account-id">{c.id}</td><td><Tag color={c.category==='คราฟ'?'gold':'green'}>{c.category}</Tag></td><td>{c.items.map(item=><Tag className="account-item" key={item} color={c.category==='คราฟ'?'gold':'green'}>{item}</Tag>)}</td><td><Button type="text" icon={<EditOutlined />} onClick={()=>edit(accounts.find(v=>v.key===a.key))} aria-label={`แก้ไข ${c.name}`}>แก้ไข</Button></td></tr>)}</tbody></table></div>
    <footer>แก้ไขล่าสุด {a.updated_at?new Date(a.updated_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'—'}</footer>
   </section>)}
   {!visible.length&&<Empty description={accounts.length?'ไม่พบรายการที่ค้นหา':'เพิ่ม Gmail แรก แล้วกำหนดของที่เก็บให้ทั้ง 3 ตัวละคร'} />}
   <Button className="accounts-add" type="dashed" block icon={<PlusOutlined />} onClick={()=>edit()}>เพิ่ม Gmail อีกบัญชี</Button>
  </>}
  <Modal open={!!draft} title={draft?.key?'แก้ไขบัญชีสต็อก':'เพิ่ม Gmail และ 3 ตัวละคร'} width={900} onCancel={()=>{if(!saving&&uploading===null)setDraft(null);}} mask={{closable:!saving&&uploading===null}} closable={!saving&&uploading===null} onOk={()=>void save()} confirmLoading={saving} okButtonProps={{disabled:uploading!==null}} cancelButtonProps={{disabled:saving||uploading!==null}} okText="บันทึกทั้ง 3 ตัว" cancelText="ยกเลิก">
   {draft&&<div className="account-editor"><label>Gmail<Input type="email" value={draft.email} maxLength={254} disabled={!!draft.key||saving} onChange={e=>setDraft(d=>d&&({...d,email:e.target.value}))} placeholder="name@gmail.com" /></label>
    {draft.characters.map((c,i)=><section className="account-character-editor" key={i}>
     <div className="account-avatar-editor"><Tooltip title="เปลี่ยนรูปตัวละคร"><label className="account-upload"><Avatar character={c}/><CameraOutlined/><input type="file" accept="image/*" disabled={saving||uploading!==null} onChange={e=>{void upload(i,e.target.files?.[0]);e.target.value='';}} /></label></Tooltip>
      <div><strong>ตัวละครที่ {i+1}</strong><div className="account-avatar-options">{Array.from({length:6},(_,n)=><button type="button" key={n} disabled={saving||uploading!==null} className={c.avatar===n&&!c.image_url?'selected':''} aria-label={`เลือก Avatar ${n+1} ให้ตัวที่ ${i+1}`} aria-pressed={c.avatar===n&&!c.image_url} onClick={()=>change(i,{avatar:n,image_url:null})}><Avatar character={{...c,avatar:n,image_url:null}}/></button>)}</div><span className="shop-muted">{uploading===i?'กำลังอัปโหลด…':'เลือกรูปเริ่มต้น หรือกดรูปเพื่ออัปโหลด'}</span></div>
     </div>
     <div className="account-editor-fields"><label>ชื่อตัวละคร<Input value={c.name} maxLength={80} disabled={saving} onChange={e=>change(i,{name:e.target.value})} placeholder={`เช่น STW0${i+1}`} /></label><label>ID ตัวละคร<Input value={c.id} maxLength={80} disabled={saving} onChange={e=>change(i,{id:e.target.value})} placeholder="เช่น 188234" /></label><label>หมวด<Select value={c.category} disabled={saving} options={[{value:'มอน/ป่า'},{value:'คราฟ'}]} onChange={category=>change(i,{category})}/></label><label className="account-stock-field">ของที่เก็บ<Select mode="tags" value={c.items} disabled={saving} maxCount={50} tokenSeparators={[',']} options={[...new Set(itemNames)].map(value=>({value,label:value}))} onChange={items=>change(i,{items})} placeholder="เลือกสินค้า หรือพิมพ์ชื่อแล้วกด Enter" /></label></div>
    </section>)}
    {error&&<Alert type="error" showIcon title={error}/>}
    {draft.key&&<Popconfirm title="ลบ Gmail และทั้ง 3 ตัวละคร?" description="ข้อมูลในสมุดบัญชีจะถูกลบ ยอดสต็อกสินค้าไม่เปลี่ยน" okText="ลบ" cancelText="ยกเลิก" onConfirm={async()=>{try{await remove(draft);setDraft(null);}catch(e){setError((e as Error).message);}}}><Button danger type="text" disabled={saving||uploading!==null} icon={<DeleteOutlined/>}>ลบบัญชีนี้</Button></Popconfirm>}
   </div>}
  </Modal>
 </section>;
}
