import { cloudTimers } from './externalAccountClient';
import { EXTERNAL_TIMER_PREFIX, readExternalTimers, createExternalTimer, updateExternalTimer } from './externalTimerStorage';
import './FloorTimerDashboard.css';
import { ItemThumbnail, ItemLabel, ItemVisualProvider, itemSelectVisuals } from '../shared/ItemVisual';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Empty, Form, Input, InputNumber, Modal, Select, Spin, Tag, message } from 'antd';
import { CheckCircleFilled, CloudOutlined, PauseCircleOutlined, PlayCircleOutlined, PlusOutlined, ReloadOutlined, SettingOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import { createFloorTimer, fetchAllData, fetchFloorTimers, updateFloorTimer } from '../../api/client';
import type { FloorDisplayStatus, FloorTimer, Machine, Recipe, StockImageMap } from '../../types';
import { machinesForProfession } from './floorOptions';

const FLOAT_GRACE_SECONDS = 15 * 60;
const professions = ['วิศวะกร', 'หมอ', 'เชฟ', 'ไอดอล', 'เกษตร', 'ทุกอาชีพ'];
const professionImages: Record<string, string> = {
  'วิศวะกร': '/occupations/engineer.png', 'หมอ': '/occupations/doctor.png',
  'เชฟ': '/occupations/chef.png', 'ไอดอล': '/occupations/idol.png', 'เกษตร': '/occupations/farmer.png',
};

type DisplayFloor = FloorTimer & { displayStatus: FloorDisplayStatus; remaining: number };

function deriveFloor(floor: FloorTimer, now: number): DisplayFloor {
  if (floor.status !== 'running' || !floor.start_time || floor.estimated_duration_seconds <= 0)
    return { ...floor, displayStatus: 'idle', remaining: 0 };
  const finish = new Date(floor.start_time).getTime() + floor.estimated_duration_seconds * 1000;
  const untilFloat = finish + FLOAT_GRACE_SECONDS * 1000;
  if (now < finish) return { ...floor, displayStatus: 'running', remaining: Math.ceil((finish - now) / 1000) };
  if (now < untilFloat) return { ...floor, displayStatus: 'completed', remaining: Math.ceil((untilFloat - now) / 1000) };
  return { ...floor, displayStatus: 'floating', remaining: 0 };
}

function clock(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function recipeSeconds(recipe?: Recipe) {
  if (!recipe?.time_per_unit) return 30 * 60;
  const [h, m, s] = recipe.time_per_unit.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

function ProfessionOption({ profession }: { profession: string }) {
  return <span className="profession-select-option">{professionImages[profession] && <img src={professionImages[profession]} alt="" />}<span>{profession}</span></span>;
}

const statusMeta: Record<FloorDisplayStatus, { label: string; color: string }> = {
  idle: { label: 'ว่าง', color: 'default' },
  running: { label: 'ทำงาน', color: 'blue' },
  completed: { label: 'เสร็จแล้ว', color: 'green' },
  floating: { label: 'ลอย', color: 'red' },
};

export function FloorTimerDashboard({ external = false, cloud = false, accountId }: { external?: boolean; cloud?: boolean; accountId?: string }) {
  const label = (floor: FloorTimer): string => external ? floor.name ?? 'เครื่องนอก' : `ชั้น ${floor.floor_number}`;
  const unit = external ? 'เครื่องนอก' : 'ชั้น';
  const [floors, setFloors] = useState<FloorTimer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stockImages, setStockImages] = useState<StockImageMap>({});
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [_timerForm] = Form.useForm<{ hours: number; minutes: number; seconds: number }>();  const [configuring, setConfiguring] = useState<FloorTimer | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [_timerForm2] = Form.useForm<{ hours: number; minutes: number; seconds: number }>();
  const [customTimerFloor, setCustomTimerFloor] = useState<FloorTimer | null>(null);
  const [customTimerForm] = Form.useForm<{ hours: number; minutes: number; seconds: number }>();
  const [floorForm] = Form.useForm<{ floor_number: number; name?: string; character_name?: string; profession?: string; machine_id?: string; recipe_id?: string }>();
  const [configForm] = Form.useForm<{ name?: string; character_name?: string; profession?: string; machine_id?: string; recipe_id?: string }>();
  const [confirmModal, confirmContext] = Modal.useModal();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!external || !cloud || loading) return;
    const id = Number(new URLSearchParams(window.location.search).get('externalTimer'));
    if (!id || !floors.some(floor => floor.floor_number === id)) return;
    setHighlighted(id);
    document.getElementById(`floor-card-${id}`)?.scrollIntoView({ block: 'center' });
  }, [external, cloud, loading]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [timerRows, data] = await Promise.all([(external ? (cloud ? cloudTimers.read(accountId) : readExternalTimers()) : fetchFloorTimers()), fetchAllData()]);
      setFloors(timerRows); setMachines(data.machines); setRecipes(data.recipes); setStockImages(data.stockImages ?? {});
    }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [external, cloud, accountId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!external || !cloud) return;
    let active = true;
    const refresh = () => {
      if (document.visibilityState !== 'visible' || saving) return;
      void cloudTimers.read(accountId).then(items => { if (active) { setFloors(items); setError(null); } })
        .catch(e => { if (active) setError(e.message); });
    };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [external, cloud, saving, accountId]);

  useEffect(() => {
    if (!external || cloud) return;
    const sync = (event: StorageEvent) => {
      if (event.key !== null && !event.key.startsWith(EXTERNAL_TIMER_PREFIX)) return;
      try { setFloors(readExternalTimers()); setError(null); }
      catch (e) { setError((e as Error).message); }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [external, cloud, accountId]);
  useEffect(() => {
    if (highlighted === null) return;
    const id = window.setTimeout(() => setHighlighted(null), 3000);
    return () => window.clearTimeout(id);
  }, [highlighted]);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);

  const displayFloors = useMemo(() => floors.map((floor) => deriveFloor(floor, now)), [floors, now]);
  const counts = useMemo(() => displayFloors.reduce<Record<FloorDisplayStatus, number>>(
    (acc, floor) => ({ ...acc, [floor.displayStatus]: acc[floor.displayStatus] + 1 }),
    { idle: 0, running: 0, completed: 0, floating: 0 },
  ), [displayFloors]);

  const patchFloor = async (floorNumber: number, patch: Partial<FloorTimer>, success: string) => {
    setSaving(true);
    try {
      const updated = await (external ? (cloud ? cloudTimers.update(floorNumber, patch, accountId) : updateExternalTimer(floorNumber, patch)) : updateFloorTimer(floorNumber, patch));
      setFloors((items) => items.map((item) => item.floor_number === floorNumber ? updated : item));
      messageApi.success(success);
      return true;
    } catch (e) { messageApi.error((e as Error).message); return false; }
    finally { setSaving(false); }
  };

  const startDirect = async (floor: FloorTimer) => {
    const recipe = recipes.find((item) => item.id === floor.recipe_id);
    const duration = recipeSeconds(recipe);
    await patchFloor(floor.floor_number, {
      status: 'running', start_time: new Date().toISOString(), estimated_duration_seconds: duration, completed_at: null,
    }, `เริ่มจับเวลา ${label(floor)} แล้ว`);
  };

  const openConfig = (floor: FloorTimer) => {
    configForm.setFieldsValue({ name: floor.name, character_name: floor.character_name ?? '', profession: floor.profession, machine_id: floor.machine_id ?? undefined, recipe_id: floor.recipe_id ?? undefined });
    setConfiguring(floor);
  };

  const saveConfig = async () => {
    const values = await configForm.validateFields();
    if (!configuring) return;
    const saved = await patchFloor(configuring.floor_number, {
      ...(external ? { name: values.name?.trim(), character_name: values.character_name?.trim() ?? '' } : {}),
      profession: values.profession, machine_id: values.machine_id ?? null, recipe_id: values.recipe_id ?? null,
    }, 'บันทึกเครื่องและสูตรแล้ว');
    if (saved) setConfiguring(null);
  };

  const chosenProfession = Form.useWatch('profession', configForm);
  const configMachines = useMemo(() => machinesForProfession(machines, chosenProfession), [machines, chosenProfession]);
  const chosenMachineId = Form.useWatch('machine_id', configForm);
  const configRecipes = useMemo(() => recipes.filter((recipe) => recipe.machine_id === chosenMachineId), [recipes, chosenMachineId]);

  // Add floor form watchers
  const addProfession = Form.useWatch('profession', floorForm);
  const addMachines = useMemo(() => machinesForProfession(machines, addProfession), [machines, addProfession]);
  const addMachineId = Form.useWatch('machine_id', floorForm);
  const addRecipes = useMemo(() => recipes.filter((r) => r.machine_id === addMachineId), [recipes, addMachineId]);

  const addFloor = async () => {
    const values = await floorForm.validateFields();
    if (!external && floors.some((floor) => floor.floor_number === values.floor_number)) {
      floorForm.setFields([{ name: 'floor_number', errors: [`ชั้น ${values.floor_number} มีอยู่ในระบบแล้ว`] }]);
      return;
    }
    setSaving(true);
    try {
      const created = external
        ? await (cloud ? (timer: Partial<FloorTimer>) => cloudTimers.create(timer, accountId) : createExternalTimer)({ name: values.name?.trim(), character_name: values.character_name?.trim() ?? '', profession: values.profession, machine_id: values.machine_id ?? null, recipe_id: values.recipe_id ?? null })
        : await createFloorTimer(values.floor_number, values.profession);
      // If machine/recipe also selected, patch immediately after create
      if (!external && (values.machine_id || values.recipe_id)) {
        const patched = await updateFloorTimer(created.floor_number, {
          machine_id: values.machine_id ?? null,
          recipe_id: values.recipe_id ?? null,
        });
        setFloors((items) => [...items, patched].sort((a, b) => a.floor_number - b.floor_number));
      } else {
        setFloors((items) => [...items, created].sort((a, b) => a.floor_number - b.floor_number));
      }
      setAddOpen(false); floorForm.resetFields(); messageApi.success(`เพิ่ม ${label(created)} แล้ว`);
    } catch (e) { messageApi.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const openAddFloor = () => {
    const nextFloor = floors.length ? Math.max(...floors.map((floor) => floor.floor_number)) + 1 : 1;
    floorForm.resetFields();
    floorForm.setFieldsValue({ floor_number: nextFloor, profession: undefined });
    setAddOpen(true);
  };

  return <ItemVisualProvider recipes={recipes} machines={machines} stockImages={stockImages}><div className={`floor-dashboard${external ? " floor-dashboard--external" : ""}`}>
    {contextHolder}
    {confirmContext}
    {error && <Alert type="error" showIcon message={`โหลดข้อมูล${unit}ไม่สำเร็จ`} description={error} action={<Button size="small" onClick={() => void load()}>ลองอีกครั้ง</Button>} />}

    {/* ── Stats bar ── */}
    {!loading && displayFloors.length > 0 && (
      <section className="floor-summary-panel"><div className="floor-stats-bar">
        {(Object.keys(statusMeta) as FloorDisplayStatus[]).map((s) => (
          <span key={s} className={`floor-stat floor-stat--${s}`}>
            <i className={`floor-dot floor-dot--${s}`} />
            {statusMeta[s].label} <b>{counts[s]}</b>
          </span>
        ))}
      </div>
      <div className={`floor-overview${external ? " external-image-overview" : ""}`}>
        <div className="floor-overview__cells">
          {displayFloors.map((floor) => (
            <button
              key={floor.floor_number}
              className={`floor-overview-cell floor-overview-cell--${floor.displayStatus}`}
              title={`${label(floor)} — ${recipes.find(recipe => recipe.id === floor.recipe_id)?.name ?? "ยังไม่ได้เลือกสูตร"} — ${statusMeta[floor.displayStatus].label}`}
              aria-label={`${label(floor)} — ${recipes.find(recipe => recipe.id === floor.recipe_id)?.name ?? "ยังไม่ได้เลือกสูตร"} — ${statusMeta[floor.displayStatus].label}`}
              onClick={() => {
                setHighlighted(floor.floor_number);
                document.getElementById(`floor-card-${floor.floor_number}`)
                  ?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
              }}
            >
              {external ? <><ItemThumbnail id={floor.recipe_id || undefined} size={38} /><i className={`floor-dot floor-dot--${floor.displayStatus}`} aria-hidden="true" /></> : floor.floor_number}
            </button>
          ))}
          {/* + add button as last cell */}
          <button
            className="floor-overview-cell floor-overview-cell--add"
            title={`เพิ่ม${unit}ใหม่`}
            onClick={openAddFloor}
          >
            <PlusOutlined style={{ fontSize: 12 }} />
          </button>
        </div>
        <p className="floor-overview__hint">แตะเพื่อไปยังรายละเอียด</p>
      </div></section>
    )}

    {/* ── Floor cards ── */}
    {loading
      ? <div className="floor-dashboard__loading"><Spin /><span>กำลังโหลดสถานะชั้น…</span></div>
      : error ? null : displayFloors.length === 0
        ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`ยังไม่มี${unit}ในระบบ`}><Button type="primary" onClick={openAddFloor}>เพิ่ม{unit}แรก</Button></Empty>
        : <section className="floor-details-panel"><div className="floor-cards-heading"><h3>รายละเอียด{unit}</h3><span>{displayFloors.length} {external ? "รายการ" : "ชั้น"}</span><Button size="small" icon={<PlusOutlined />} onClick={openAddFloor}>เพิ่ม{unit}</Button></div>
            <div className="floor-cards-scroll">
              {displayFloors.map((floor) => {
                const meta = statusMeta[floor.displayStatus];
                const machine = machines.find((m) => m.machine_id === floor.machine_id);
                const recipe = recipes.find((r) => r.id === floor.recipe_id);
                const finishTime = floor.start_time && floor.estimated_duration_seconds
                  ? new Date(new Date(floor.start_time).getTime() + floor.estimated_duration_seconds * 1000) : null;
                const progress = floor.displayStatus === 'idle' ? 0 : floor.displayStatus === 'running'
                  ? Math.max(0, Math.min(100, (1 - floor.remaining / floor.estimated_duration_seconds) * 100)) : 100;
                const statusImage = { running: 'working', completed: 'completed', floating: 'floating', idle: '' }[floor.displayStatus];
                return (
                  <div id={`floor-card-${floor.floor_number}`} key={floor.floor_number}
                    className={`floor-card2 floor-card2--${floor.displayStatus}${highlighted === floor.floor_number ? " is-highlighted" : ""}`}>
                    {/* Head */}
                    <div className="floor-card2__head">
                      <span className="floor-card2__num" title={label(floor)}>{label(floor)}</span>
                      {!external && <Tag color={meta.color}>{meta.label}</Tag>}
                      <Button className="floor-card2__settings" type="text" size="small" aria-label={`ตั้งค่า ${label(floor)}`} icon={<SettingOutlined />} onClick={() => openConfig(floor)} />
                    </div>
                    {/* Machine + finish time */}
                    <div className="floor-card2__machine">
                      <span>{machine?.machine_name ?? 'ยังไม่ได้เลือกเครื่อง'}</span>
                      {external && <Tag color={meta.color}>{meta.label}</Tag>}
                      {finishTime && (floor.displayStatus === 'running' || floor.displayStatus === 'completed') && <span className="floor-card2__finish-time">เสร็จ {finishTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                    {!external && <div className="floor-card2__avatar">{statusImage ? <img src={`/floor-status/${statusImage}.png`} alt={meta.label} /> : <PauseCircleOutlined />}</div>}
                    {external && <div className="external-progress" role="progressbar" aria-label={`${recipe?.name ?? 'ยังไม่ได้เลือกสูตร'} — ${meta.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
                      <svg viewBox="0 0 100 100" aria-hidden="true"><circle className="external-progress__track" cx="50" cy="50" r="44" /><circle className="external-progress__value" cx="50" cy="50" r="44" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress} /></svg>
                      <div className="external-recipe-image" title={recipe?.name ?? 'ยังไม่ได้เลือกสูตร'}>{recipe ? <ItemThumbnail id={recipe.id} image={recipe.image} size={52} /> : <span>—</span>}</div>
                      {floor.displayStatus === 'completed' && <span className="external-progress__badge" key="completed"><CheckCircleFilled /></span>}
                      {floor.displayStatus === 'floating' && <span className="external-progress__badge" key="floating"><CloudOutlined /></span>}
                    </div>}
                    {external ? <div className="floor-card2__status external-item-status">
                      <span className="external-item-state">{floor.displayStatus === 'running' ? <PlayCircleOutlined /> : floor.displayStatus === 'completed' ? <CheckCircleFilled /> : floor.displayStatus === 'floating' ? <CloudOutlined /> : <PauseCircleOutlined />}{floor.displayStatus === 'running' ? 'กำลังทำ' : floor.displayStatus === 'floating' ? 'ลอยแล้ว' : floor.displayStatus === 'completed' ? 'เสร็จ · ก่อนลอย' : meta.label}</span>
                      <b className="external-item-time">{floor.displayStatus === 'idle' ? 'พร้อมเริ่ม' : clock(floor.displayStatus === 'floating' ? (finishTime ? Math.max(0, Math.floor((now - finishTime.getTime()) / 1000) - FLOAT_GRACE_SECONDS) : 0) : floor.remaining)}</b>
                      {finishTime && floor.displayStatus !== 'idle' && <span className="external-item-note" title={finishTime.toLocaleString('th-TH')}>
                        <span>{floor.displayStatus === 'floating' ? 'เสร็จตั้งแต่' : 'เสร็จ'} </span>
                        <span>{finishTime.toDateString() !== new Date(now).toDateString() && `${finishTime.getDate()}/${finishTime.getMonth() + 1} `}{finishTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                      </span>}

                    </div> : <>
                    <div className="floor-card2__status">
                      {floor.displayStatus === 'idle' && <span className="fcs--idle">พร้อมใช้งาน</span>}
                      {floor.displayStatus === 'running' && <><b className="fcs--timer">{clock(floor.remaining)}</b><span className="fcs--sub">เสร็จ {finishTime?.toLocaleTimeString(external ? 'en-US' : 'th-TH', { hour: external ? 'numeric' : '2-digit', minute: '2-digit', hour12: external })}</span></>}
                      {floor.displayStatus === 'completed' && <><b className="fcs--done">{external ? 'เสร็จแล้ว' : 'เสร็จแล้ว!!'}</b><span className="fcs--sub">{clock(floor.remaining)} ก่อนลอย</span></>}
                      {floor.displayStatus === 'floating' && <><b className="fcs--float">{external ? 'ลอยแล้ว' : 'ลอยแล้วพรี่!!'}</b><span className="fcs--sub">{clock(finishTime ? Math.max(0, Math.floor((now - finishTime.getTime()) / 1000) - FLOAT_GRACE_SECONDS) : 0)}</span></>}
                    </div>
                    </>}
                    {/* Recipe */}
                    {external
                      ? <div className="floor-card2__recipe" title={floor.character_name || 'ยังไม่ได้ระบุชื่อตัวละคร'}><UserOutlined aria-hidden="true" /><span className="external-character-name">{floor.character_name || 'ยังไม่ได้ระบุชื่อตัวละคร'}</span></div>
                      : recipe && <div className="floor-card2__recipe"><ItemLabel id={recipe.id} name={recipe.name} image={recipe.image} size={16} reserveImage /></div>}
                    {/* Actions */}
                    <div className="floor-card2__actions">
                      {floor.displayStatus === 'running'
                        ? <Button className="floor-card2__stop" size="small" icon={<PauseCircleOutlined />} onClick={() => void patchFloor(floor.floor_number, { status: 'idle', start_time: null, estimated_duration_seconds: 0, completed_at: null }, 'หยุดแล้ว')}>หยุด</Button>
                        : <Button size="small" type="primary" icon={<PlayCircleOutlined />} disabled={!floor.recipe_id} loading={saving} onClick={() => void startDirect(floor)}>เริ่ม</Button>}
                      <Button size="small" icon={<ClockCircleOutlined />} onClick={() => { const seconds = recipeSeconds(recipe); customTimerForm.setFieldsValue({ hours: Math.floor(seconds / 3600), minutes: Math.floor(seconds % 3600 / 60), seconds: seconds % 60 }); setCustomTimerFloor(floor); }} title="กำหนดเวลาเอง" />
                      <Button className="floor-card2__reset" aria-label={`รีเซ็ต ${label(floor)}`} title="รีเซ็ต" size="small" icon={<ReloadOutlined />} onClick={() => {
                        const reset = () => patchFloor(floor.floor_number, { status: 'idle', start_time: null, estimated_duration_seconds: 0, completed_at: null }, 'รีเซ็ตแล้ว');
                        if (!external) { void reset(); return; }
                        confirmModal.confirm({ title: `รีเซ็ต ${label(floor)}?`, content: 'เวลาที่จับอยู่จะถูกล้าง และเครื่องจะกลับเป็นสถานะว่าง สูตรและชื่อตัวละครยังอยู่', okText: 'รีเซ็ตเวลา', cancelText: 'ยกเลิก', okButtonProps: { danger: true }, onOk: async () => { if (!await reset()) throw new Error('รีเซ็ตไม่สำเร็จ'); } });
                      }}>{external ? null : 'รีเซ็ต'}</Button>
                    </div>
                  </div>
                );
              })}
            </div></section>
    }


    <Modal
      open={!!customTimerFloor}
      onCancel={() => setCustomTimerFloor(null)}
      title={`กำหนดเวลาเอง — ${customTimerFloor ? label(customTimerFloor) : ""}`}
      okText="เริ่มจับเวลา"
      cancelText="ยกเลิก"
      okButtonProps={{ loading: saving, icon: <PlayCircleOutlined /> }}
      onOk={async () => {
        const values = await customTimerForm.validateFields();
        const duration = (values.hours || 0) * 3600 + (values.minutes || 0) * 60 + (values.seconds || 0);
        if (!duration) { customTimerForm.setFields([{ name: 'seconds', errors: ['ตั้งเวลาอย่างน้อย 1 วินาที'] }]); return; }
        const saved = await patchFloor(customTimerFloor!.floor_number, { status: 'running', start_time: new Date().toISOString(), estimated_duration_seconds: duration, completed_at: null }, `เริ่มจับเวลา ${label(customTimerFloor!)} แล้ว`);
        if (saved) setCustomTimerFloor(null);
      }}
    >
      <p className="floor-modal-note">ระบุเวลาที่ต้องการ — ระบบจะเริ่มนับถอยหลังทันที</p>
      <Form form={customTimerForm} layout="vertical" initialValues={{ hours: 0, minutes: 30, seconds: 0 }}>
        <div className="floor-time-inputs">
          <Form.Item label="ชั่วโมง" name="hours" rules={[{ required: true }]}><InputNumber min={0} max={99} /></Form.Item>
          <Form.Item label="นาที" name="minutes" rules={[{ required: true }]}><InputNumber min={0} max={59} /></Form.Item>
          <Form.Item label="วินาที" name="seconds" rules={[{ required: true }]}><InputNumber min={0} max={59} /></Form.Item>
        </div>
      </Form>
    </Modal>

    <Modal open={!!configuring} onCancel={() => setConfiguring(null)} onOk={() => void saveConfig()} okText="บันทึกการตั้งค่า" okButtonProps={{ loading: saving }} cancelText="ยกเลิก" title={`ตั้งค่าเครื่องและสูตร — ${configuring ? label(configuring) : ""}`}>
      <p className="floor-modal-note">เปลี่ยนอาชีพได้จากตรงนี้ โดยเครื่องและสูตรเดิมจะถูกล้างเพื่อให้เลือกใหม่อย่างถูกต้อง</p>
      <Form form={configForm} layout="vertical">
        {external && <Form.Item label="ชื่อเครื่องนอก / กลุ่มเครื่อง" name="name" rules={[{ required: true, whitespace: true, message: 'กรอกชื่อเครื่องนอก' }, { max: 120 }]}><Input maxLength={120} placeholder="เช่น แลปนอกวิศวะ ชั้น 1-3" /></Form.Item>}
        {external && <Form.Item label="ชื่อตัวละคร" name="character_name" rules={[{ max: 80, message: 'ชื่อตัวละครต้องไม่เกิน 80 ตัวอักษร' }]}><Input maxLength={80} placeholder="กรอกชื่อตัวละคร" /></Form.Item>}
        <Form.Item label="อาชีพประจำชั้น" name="profession" rules={[{ required: true, message: 'เลือกอาชีพ' }]}>
          <Select
            placeholder="เลือกอาชีพ" optionLabelProp="label" labelRender={itemSelectVisuals.labelRender}
            options={professions.map((profession) => ({ value: profession, label: profession, children: <ProfessionOption profession={profession} /> }))}
            optionRender={(option) => option.data.children}
            onChange={() => configForm.setFieldsValue({ machine_id: undefined, recipe_id: undefined })}
          />
        </Form.Item>
        <Form.Item label="เครื่องจักร" name="machine_id" rules={[{ required: true, message: 'เลือกเครื่องจักร' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            disabled={!chosenProfession}
            placeholder={chosenProfession ? 'เลือกเครื่องจักร' : 'เลือกอาชีพก่อน'}
            optionLabelProp="label"
            labelRender={({ value }) => <ItemLabel id={String(value)} name={machines.find((machine) => machine.machine_id === value)?.machine_name ?? 'ไม่พบเครื่องจักรเดิม กรุณาเลือกใหม่'} size={22} />}
            options={configMachines.map((machine) => ({
              value: machine.machine_id,
              label: machine.machine_name,
              children: <ItemLabel id={machine.machine_id} name={machine.machine_name} image={machine.image} size={28} reserveImage />,
            }))}
            optionRender={(option) => option.data.children}
            onChange={() => configForm.setFieldValue('recipe_id', undefined)}
          />
        </Form.Item>
        <Form.Item label="สูตรการผลิต" name="recipe_id" rules={[{ required: true, message: 'เลือกสูตรการผลิต' }]}>
          <Select {...itemSelectVisuals} showSearch optionFilterProp="label" labelRender={({ value }) => <ItemLabel id={String(value)} name={recipes.find((recipe) => recipe.id === value)?.name ?? 'ไม่พบสูตรเดิม กรุณาเลือกใหม่'} size={22} />} disabled={!chosenMachineId} placeholder={chosenMachineId ? 'เลือกสูตรการผลิต' : 'เลือกเครื่องจักรก่อน'} options={configRecipes.map((recipe) => ({ value: recipe.id, label: `${recipe.name}${recipe.time_per_unit ? ` (${recipe.time_per_unit})` : ''}` }))} />
        </Form.Item>
      </Form>
    </Modal>

    <Modal open={addOpen} onCancel={() => setAddOpen(false)} onOk={() => void addFloor()} okText={`เพิ่ม${unit}`} okButtonProps={{ loading: saving }} cancelText="ยกเลิก" title={`เพิ่ม${unit}ใหม่`}>
      <Form form={floorForm} layout="vertical">
        {external && <Form.Item label="ชื่อเครื่องนอก / กลุ่มเครื่อง" name="name" rules={[{ required: true, whitespace: true, message: 'กรอกชื่อเครื่องนอก' }, { max: 120 }]}><Input maxLength={120} placeholder="เช่น แลปนอกวิศวะ ชั้น 1-3" /></Form.Item>}
        {external && <Form.Item label="ชื่อตัวละคร" name="character_name" rules={[{ max: 80, message: 'ชื่อตัวละครต้องไม่เกิน 80 ตัวอักษร' }]}><Input maxLength={80} placeholder="กรอกชื่อตัวละคร" /></Form.Item>}
        <Form.Item hidden={external} label="หมายเลขชั้น" name="floor_number" rules={[{ required: true, message: 'กรอกหมายเลขชั้น' }]}>
          <InputNumber min={1} precision={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="อาชีพ" name="profession" rules={[{ required: true, message: 'เลือกอาชีพประจำชั้น' }]}>
          <Select
            placeholder="เลือกอาชีพ" optionLabelProp="label" labelRender={itemSelectVisuals.labelRender}
            options={professions.map((p) => ({ value: p, label: p, children: <ProfessionOption profession={p} /> }))}
            optionRender={(opt) => opt.data.children}
            onChange={() => floorForm.setFieldsValue({ machine_id: undefined, recipe_id: undefined })}
          />
        </Form.Item>
        <Form.Item label="เครื่องจักร (ไม่บังคับ)" name="machine_id">
          <Select
            showSearch optionFilterProp="label"
            disabled={!addProfession}
            placeholder={addProfession ? 'เลือกเครื่องจักร' : 'เลือกอาชีพก่อน'}
            allowClear
            optionLabelProp="label"
            labelRender={({ value }) => <ItemLabel id={String(value)} name={machines.find((m) => m.machine_id === value)?.machine_name ?? ''} size={22} />}
            options={addMachines.map((m) => ({
              value: m.machine_id, label: m.machine_name,
              children: <ItemLabel id={m.machine_id} name={m.machine_name} image={m.image} size={28} reserveImage />,
            }))}
            optionRender={(opt) => opt.data.children}
            onChange={() => floorForm.setFieldValue('recipe_id', undefined)}
          />
        </Form.Item>
        <Form.Item label="สูตรการผลิต (ไม่บังคับ)" name="recipe_id">
          <Select
            {...itemSelectVisuals} showSearch optionFilterProp="label" allowClear
            disabled={!addMachineId}
            placeholder={addMachineId ? 'เลือกสูตร' : 'เลือกเครื่องก่อน'}
            labelRender={({ value }) => <ItemLabel id={String(value)} name={recipes.find((r) => r.id === value)?.name ?? ''} size={22} />}
            options={addRecipes.map((r) => ({ value: r.id, label: `${r.name}${r.time_per_unit ? ` (${r.time_per_unit})` : ''}` }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  </div></ItemVisualProvider>;
}
