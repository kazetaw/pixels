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
 const [originalDraft,setOriginalDraft]=useState('');
 const [modal,modalContext]=Modal.useModal();
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
 const edit=(account?:Account)=>{const next=account?{...account,characters:account.characters.map(c=>({...c,items:[...c.items]}))}:blank();setDraft(next);setOriginalDraft(JSON.stringify(next));setError('');};
 const closeEditor=async()=>{if(saving||uploading!==null)return;if(draft&&JSON.stringify(draft)!==originalDraft){const discard=await modal.confirm({title:'ยังมีข้อมูลที่ไม่ได้บันทึก',content:'ต้องการปิดฟอร์มและทิ้งการแก้ไขหรือไม่?',okText:'ทิ้งการแก้ไข',cancelText:'กลับไปกรอกต่อ',okButtonProps:{danger:true}});if(!discard)return;}setDraft(null);};
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
 return <section className="accounts">{context}{modalContext}
  <div className="accounts-tools"><Input prefix={<SearchOutlined />} value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหา Gmail, ตัวละคร, ID หรือของที่เก็บ" allowClear aria-label="ค้นหาสมุดบัญชี" />
   <Segmented aria-label="กรองหมวดสมุดบัญชี" value={filter} onChange={setFilter} options={['ทั้งหมด','มอน/ป่า','คราฟ']} />
   <Button type="primary" icon={<PlusOutlined />} onClick={()=>edit()}>เพิ่ม Gmail</Button>
  </div>
  <div className="accounts-caption"><span>{accounts.length} Gmail · {accounts.length*3} ตัวละคร</span><span>1 Gmail มี 3 ตัวละคร · แต่ละตัวเก็บของได้หลายอย่าง</span></div>
  {loadError&&<Alert type="error" showIcon title={loadError} action={<Button onClick={()=>void load()}>ลองใหม่</Button>} />}
  {loading?<div className="accounts-loading"><Spin /></div>:!loadError&&<>
   <div className={`accounts-board${filter !== 'ทั้งหมด' ? ' accounts-board--single' : ''}`}>
    {(['มอน/ป่า','คราฟ'] as const).filter(category=>filter==='ทั้งหมด'||filter===category).map(category=>{
     const groups=visible.map(a=>({...a,characters:a.characters.filter(c=>c.category===category)})).filter(a=>a.characters.length);
     return <section className={`accounts-lane ${category==='คราฟ'?'accounts-lane--craft':'accounts-lane--forest'}`} key={category} aria-label={`บัญชีหมวด${category}`}>
      <header className="accounts-lane__head"><h2>{category}</h2><span>{groups.length} เมล · {groups.reduce((n,a)=>n+a.characters.length,0)} ตัวละคร</span></header>
      {groups.map(a=><section className="account-group" key={a.key}>
       <header><div><MailOutlined /><strong>{a.email}</strong></div><Tooltip title="แก้ไขบัญชีและตัวละคร"><Button type="text" icon={<EditOutlined />} onClick={()=>edit(accounts.find(v=>v.key===a.key))} aria-label={`แก้ไข ${a.email} หมวด${category}`} /></Tooltip></header>
       <div className="account-compact-head"><span>ตัวละคร / ID</span><span>ของที่เก็บ</span></div>
       <ul className="account-characters">{a.characters.map(c=><li key={c.id}>
        <div className="account-person"><Avatar character={c}/><div><strong>{c.name}</strong><span className="account-id">ID {c.id}</span></div></div>
        <div className="account-items">{c.items.map(item=><Tag className="account-item" key={item}>{item}</Tag>)}</div>
       </li>)}</ul>
       <footer><span>หมวดนี้ {a.characters.length} / 3 ตัวละคร</span><span>แก้ไข {a.updated_at?new Date(a.updated_at).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short'}):'—'}</span></footer>
      </section>)}
      {!groups.length&&<p className="accounts-lane__empty">{q?'ไม่พบตัวละครในหมวดนี้':'ยังไม่มีตัวละครในหมวดนี้'}</p>}
     </section>;
    })}
   </div>
   {!visible.length&&<Empty description={accounts.length?'ไม่พบรายการที่ค้นหา':'เพิ่ม Gmail แรก แล้วกำหนดของที่เก็บให้ทั้ง 3 ตัวละคร'}>{accounts.length>0&&<Button onClick={()=>{setQuery('');setFilter('ทั้งหมด');}}>ล้างการค้นหาและตัวกรอง</Button>}</Empty>}
   <Button className="accounts-add" type="dashed" block icon={<PlusOutlined />} onClick={()=>edit()}>เพิ่ม Gmail อีกบัญชี</Button>
  </>}
  <Modal open={!!draft} title={draft?.key?'แก้ไขบัญชีสต็อก':'เพิ่ม Gmail และ 3 ตัวละคร'} width={900} onCancel={()=>void closeEditor()} mask={{closable:!saving&&uploading===null}} closable={!saving&&uploading===null} onOk={()=>void save()} confirmLoading={saving} okButtonProps={{disabled:uploading!==null}} cancelButtonProps={{disabled:saving||uploading!==null}} okText="บันทึกทั้ง 3 ตัว" cancelText="ยกเลิก">
   {draft&&<div className="account-editor"><label>Gmail<Input type="email" value={draft.email} maxLength={254} disabled={!!draft.key||saving} onChange={e=>setDraft(d=>d&&({...d,email:e.target.value}))} placeholder="name@gmail.com" /></label>
    {draft.characters.map((c,i)=><section className="account-character-editor" key={i}>
     <div className="account-avatar-editor"><Tooltip title="เปลี่ยนรูปตัวละคร"><label className="account-upload" aria-label={`เปลี่ยนรูปตัวละครที่ ${i+1}`}><Avatar character={c}/><CameraOutlined/><input type="file" accept="image/*" disabled={saving||uploading!==null} onChange={e=>{void upload(i,e.target.files?.[0]);e.target.value='';}} /></label></Tooltip>
      <div><strong>ตัวละครที่ {i+1}</strong><div className="account-avatar-options">{Array.from({length:6},(_,n)=><button type="button" key={n} disabled={saving||uploading!==null} className={c.avatar===n&&!c.image_url?'selected':''} aria-label={`เลือก Avatar ${n+1} ให้ตัวที่ ${i+1}`} aria-pressed={c.avatar===n&&!c.image_url} onClick={()=>change(i,{avatar:n,image_url:null})}><Avatar character={{...c,avatar:n,image_url:null}}/></button>)}</div><span className="shop-muted">{uploading===i?'กำลังอัปโหลด…':'เลือกรูปเริ่มต้น หรือกดรูปเพื่ออัปโหลด'}</span></div>
     </div>
     <div className="account-editor-fields"><label>ชื่อตัวละคร<Input value={c.name} maxLength={80} disabled={saving} onChange={e=>change(i,{name:e.target.value})} placeholder={`เช่น STW0${i+1}`} /></label><label>ID ตัวละคร<Input value={c.id} maxLength={80} disabled={saving} onChange={e=>change(i,{id:e.target.value})} placeholder="เช่น 188234" /></label><label>หมวด<Select value={c.category} disabled={saving} options={[{value:'มอน/ป่า'},{value:'คราฟ'}]} onChange={category=>change(i,{category})}/></label><label className="account-stock-field">ของที่เก็บ<Select mode="tags" value={c.items} disabled={saving} maxCount={50} tokenSeparators={[',']} options={[...new Set(itemNames)].map(value=>({value,label:value}))} onChange={items=>change(i,{items})} placeholder="เลือกสินค้า หรือพิมพ์ชื่อแล้วกด Enter" /></label></div>
    </section>)}
    {error&&<Alert type="error" showIcon title={error}/>}
    {draft.key&&<Popconfirm title="ลบ Gmail และทั้ง 3 ตัวละคร?" description="ข้อมูลในสมุดบัญชีจะถูกลบ ยอดสต็อกสินค้าไม่เปลี่ยน" okText="ลบ" cancelText="ยกเลิก" onConfirm={async()=>{if(saving)return;setSaving(true);try{await remove(draft);setDraft(null);}catch(e){setError((e as Error).message);}finally{setSaving(false);}}}><Button danger type="text" disabled={saving||uploading!==null} icon={<DeleteOutlined/>}>ลบบัญชีนี้</Button></Popconfirm>}
   </div>}
  </Modal>
 </section>;
}
