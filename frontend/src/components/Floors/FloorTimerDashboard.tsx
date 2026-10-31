import './FloorTimerDashboard.css';
import { ItemThumbnail, ItemLabel, ItemVisualProvider, itemSelectVisuals } from '../shared/ItemVisual';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Empty, Form, InputNumber, Modal, Select, Spin, Tag, Tooltip, message } from 'antd';
import { ClockCircleOutlined, PauseCircleOutlined, PlayCircleOutlined, PlusOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
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

export function FloorTimerDashboard() {
  const [floors, setFloors] = useState<FloorTimer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stockImages, setStockImages] = useState<StockImageMap>({});
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | FloorDisplayStatus>('all');
  const [_timerForm] = Form.useForm<{ hours: number; minutes: number; seconds: number }>();  const [configuring, setConfiguring] = useState<FloorTimer | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [_timerForm2] = Form.useForm<{ hours: number; minutes: number; seconds: number }>();
  const [customTimerFloor, setCustomTimerFloor] = useState<FloorTimer | null>(null);
  const [customTimerForm] = Form.useForm<{ hours: number; minutes: number; seconds: number }>();
  const [floorForm] = Form.useForm<{ floor_number: number; profession?: string; machine_id?: string; recipe_id?: string }>();
  const [configForm] = Form.useForm<{ profession?: string; machine_id?: string; recipe_id?: string }>();
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [timerRows, data] = await Promise.all([fetchFloorTimers(), fetchAllData()]);
      setFloors(timerRows); setMachines(data.machines); setRecipes(data.recipes); setStockImages(data.stockImages ?? {});
    }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
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
      const updated = await updateFloorTimer(floorNumber, patch);
      setFloors((items) => items.map((item) => item.floor_number === floorNumber ? updated : item));
      messageApi.success(success);
    } catch (e) { messageApi.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const startDirect = async (floor: FloorTimer) => {
    const recipe = recipes.find((item) => item.id === floor.recipe_id);
    const duration = recipeSeconds(recipe);
    await patchFloor(floor.floor_number, {
      status: 'running', start_time: new Date().toISOString(), estimated_duration_seconds: duration, completed_at: null,
    }, `เริ่มจับเวลาชั้น ${floor.floor_number} แล้ว`);
  };

  const openConfig = (floor: FloorTimer) => {
    configForm.setFieldsValue({ profession: floor.profession, machine_id: floor.machine_id ?? undefined, recipe_id: floor.recipe_id ?? undefined });
    setConfiguring(floor);
  };

  const saveConfig = async () => {
    const values = await configForm.validateFields();
    if (!configuring) return;
    await patchFloor(configuring.floor_number, {
      profession: values.profession, machine_id: values.machine_id ?? null, recipe_id: values.recipe_id ?? null,
    }, 'บันทึกเครื่องและสูตรแล้ว');
    setConfiguring(null);
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
    if (floors.some((floor) => floor.floor_number === values.floor_number)) {
      floorForm.setFields([{ name: 'floor_number', errors: [`ชั้น ${values.floor_number} มีอยู่ในระบบแล้ว`] }]);
      return;
    }
    setSaving(true);
    try {
      const created = await createFloorTimer(values.floor_number, values.profession);
      // If machine/recipe also selected, patch immediately after create
      if (values.machine_id || values.recipe_id) {
        const patched = await updateFloorTimer(created.floor_number, {
          machine_id: values.machine_id ?? null,
          recipe_id: values.recipe_id ?? null,
        });
        setFloors((items) => [...items, patched].sort((a, b) => a.floor_number - b.floor_number));
      } else {
        setFloors((items) => [...items, created].sort((a, b) => a.floor_number - b.floor_number));
      }
      setAddOpen(false); floorForm.resetFields(); messageApi.success(`เพิ่มชั้น ${created.floor_number} แล้ว`);
    } catch (e) { messageApi.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const openAddFloor = () => {
    const nextFloor = floors.length ? Math.max(...floors.map((floor) => floor.floor_number)) + 1 : 1;
    floorForm.setFieldsValue({ floor_number: nextFloor, profession: undefined });
    setAddOpen(true);
  };

  const visibleFloors = statusFilter === 'all' ? displayFloors : displayFloors.filter((floor) => floor.displayStatus === statusFilter);
  const resetFloor = (floor: FloorTimer, success: string) => void patchFloor(floor.floor_number, { status: 'idle', start_time: null, estimated_duration_seconds: 0, completed_at: null }, success);
  const hhmm = (d: Date | null) => d?.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) ?? '';

  return <ItemVisualProvider recipes={recipes} machines={machines} stockImages={stockImages}><div className="floor-dashboard">
    {contextHolder}
    {error && <Alert type="error" showIcon message="โหลดข้อมูลชั้นไม่สำเร็จ" description={error} action={<Button size="small" onClick={() => void load()}>ลองอีกครั้ง</Button>} />}

    {loading
      ? <div className="floor-dashboard__loading"><Spin /><span>กำลังโหลดสถานะชั้น…</span></div>
      : displayFloors.length === 0
        ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีชั้นในระบบ"><Button type="primary" onClick={openAddFloor}>เพิ่มชั้นแรก</Button></Empty>
        : <>
          {/* ── Summary: counts double as filters ── */}
          <section className="floor-summary" aria-label="สรุปสถานะชั้น">
            {(['all', 'running', 'completed', 'floating', 'idle'] as const).map((key) => (
              <button key={key} type="button" aria-pressed={statusFilter === key}
                className={`floor-summary__item floor-summary__item--${key}${statusFilter === key ? ' is-active' : ''}`}
                onClick={() => setStatusFilter(key)}>
                <span className="floor-summary__label">{key !== 'all' && <i className={`floor-dot floor-dot--${key}`} />}{key === 'all' ? 'ทั้งหมด' : statusMeta[key].label}</span>
                <b>{key === 'all' ? displayFloors.length : counts[key]}</b>
              </button>
            ))}
          </section>

          {/* ── Floor map: one cell per floor, click to jump ── */}
          <section className="floor-map" aria-label="ผังชั้น">
            <div className="floor-map__cells">
              {displayFloors.map((floor) => (
                <button key={floor.floor_number} type="button"
                  className={`floor-map__cell floor-map__cell--${floor.displayStatus}`}
                  title={`ชั้น ${floor.floor_number} — ${statusMeta[floor.displayStatus].label}`}
                  onClick={() => {
                    setStatusFilter('all'); setHighlighted(floor.floor_number);
                    window.setTimeout(() => document.getElementById(`floor-card-${floor.floor_number}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
                  }}>{floor.floor_number}</button>
              ))}
            </div>
            <Button icon={<PlusOutlined />} onClick={openAddFloor}>เพิ่มชั้น</Button>
          </section>

          {/* ── Floor cards ── */}
          {visibleFloors.length === 0
            ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`ไม่มีชั้นที่${statusFilter === 'all' ? '' : statusMeta[statusFilter].label}`} />
            : <div className="floor-grid">
              {visibleFloors.map((floor) => {
                const meta = statusMeta[floor.displayStatus];
                const machine = machines.find((m) => m.machine_id === floor.machine_id);
                const recipe = recipes.find((r) => r.id === floor.recipe_id);
                const finishTime = floor.start_time && floor.estimated_duration_seconds
                  ? new Date(new Date(floor.start_time).getTime() + floor.estimated_duration_seconds * 1000) : null;
                const progress = floor.displayStatus === 'running' && floor.estimated_duration_seconds
                  ? Math.min(100, Math.max(0, 100 - (floor.remaining / floor.estimated_duration_seconds) * 100)) : floor.displayStatus === 'idle' ? 0 : 100;
                const overdue = finishTime ? Math.max(0, Math.floor((now - finishTime.getTime()) / 1000) - FLOAT_GRACE_SECONDS) : 0;
                return (
                  <article id={`floor-card-${floor.floor_number}`} key={floor.floor_number}
                    className={`floor-tile floor-tile--${floor.displayStatus}${highlighted === floor.floor_number ? ' is-highlighted' : ''}`}>
                    <header className="floor-tile__head">
                      <strong>ชั้น {floor.floor_number}</strong>
                      <Tag color={meta.color} variant="filled">{meta.label}</Tag>
                      <Tooltip title="ตั้งค่าเครื่องและสูตร"><Button type="text" size="small" aria-label={`ตั้งค่าชั้น ${floor.floor_number}`} icon={<SettingOutlined />} onClick={() => openConfig(floor)} /></Tooltip>
                    </header>

                    <div className="floor-tile__product">
                      <span className="floor-tile__img"><ItemThumbnail id={recipe?.id} image={recipe?.image} size={52} /></span>
                      <div>
                        <b title={recipe?.name}>{recipe?.name ?? 'ยังไม่ได้เลือกสูตร'}</b>
                        <span title={machine?.machine_name}>{machine?.machine_name ?? 'ยังไม่ได้เลือกเครื่อง'}</span>
                      </div>
                    </div>

                    <div className="floor-tile__status">
                      {floor.displayStatus === 'idle' && <><b>พร้อมใช้งาน</b><span>{recipe ? `ใช้เวลา ${clock(recipeSeconds(recipe))}` : 'ตั้งค่าสูตรก่อนเริ่ม'}</span></>}
                      {floor.displayStatus === 'running' && <><b className="is-timer">{clock(floor.remaining)}</b><span>เสร็จเวลา {hhmm(finishTime)}</span></>}
                      {floor.displayStatus === 'completed' && <><b>เสร็จแล้ว</b><span>ลอยในอีก {clock(floor.remaining)}</span></>}
                      {floor.displayStatus === 'floating' && <><b>ลอยแล้ว</b><span>เกินมา {clock(overdue)}</span></>}
                      <div className="floor-tile__bar" aria-hidden><i style={{ width: `${progress}%` }} /></div>
                    </div>

                    <footer className="floor-tile__actions">
                      {floor.displayStatus === 'running'
                        ? <Button block className="floor-tile__stop" icon={<PauseCircleOutlined />} onClick={() => resetFloor(floor, 'หยุดแล้ว')}>หยุด</Button>
                        : <Button block type="primary" icon={<PlayCircleOutlined />} disabled={!floor.recipe_id} loading={saving} onClick={() => void startDirect(floor)}>{floor.displayStatus === 'idle' ? 'เริ่ม' : 'เริ่มใหม่'}</Button>}
                      <Tooltip title="กำหนดเวลาเอง"><Button aria-label={`กำหนดเวลาเอง ชั้น ${floor.floor_number}`} icon={<ClockCircleOutlined />} onClick={() => { customTimerForm.setFieldsValue({ hours: 0, minutes: 30, seconds: 0 }); setCustomTimerFloor(floor); }} /></Tooltip>
                      <Tooltip title="รีเซ็ตเป็นว่าง"><Button aria-label={`รีเซ็ต ชั้น ${floor.floor_number}`} icon={<ReloadOutlined />} disabled={floor.displayStatus === 'idle'} onClick={() => resetFloor(floor, 'รีเซ็ตแล้ว')} /></Tooltip>
                    </footer>
                  </article>
                );
              })}
            </div>}
        </>}

    <Modal
      open={!!customTimerFloor}
      onCancel={() => setCustomTimerFloor(null)}
      title={`กำหนดเวลาเอง — ชั้น ${customTimerFloor?.floor_number ?? ''}`}
      okText="เริ่มจับเวลา"
      cancelText="ยกเลิก"
      okButtonProps={{ loading: saving, icon: <PlayCircleOutlined /> }}
      onOk={async () => {
        const values = await customTimerForm.validateFields();
        const duration = (values.hours || 0) * 3600 + (values.minutes || 0) * 60 + (values.seconds || 0);
        if (!duration) { customTimerForm.setFields([{ name: 'seconds', errors: ['ตั้งเวลาอย่างน้อย 1 วินาที'] }]); return; }
        await patchFloor(customTimerFloor!.floor_number, { status: 'running', start_time: new Date().toISOString(), estimated_duration_seconds: duration, completed_at: null }, `เริ่มจับเวลาชั้น ${customTimerFloor!.floor_number} แล้ว`);
        setCustomTimerFloor(null);
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

    <Modal open={!!configuring} onCancel={() => setConfiguring(null)} onOk={() => void saveConfig()} okText="บันทึกการตั้งค่า" okButtonProps={{ loading: saving }} cancelText="ยกเลิก" title={`ตั้งค่าเครื่องและสูตร — ชั้น ${configuring?.floor_number ?? ''}`}>
      <p className="floor-modal-note">เปลี่ยนอาชีพได้จากตรงนี้ โดยเครื่องและสูตรเดิมจะถูกล้างเพื่อให้เลือกใหม่อย่างถูกต้อง</p>
      <Form form={configForm} layout="vertical">
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

    <Modal open={addOpen} onCancel={() => setAddOpen(false)} onOk={() => void addFloor()} okText="เพิ่มชั้น" okButtonProps={{ loading: saving }} cancelText="ยกเลิก" title="เพิ่มชั้นใหม่">
      <Form form={floorForm} layout="vertical">
        <Form.Item label="หมายเลขชั้น" name="floor_number" rules={[{ required: true, message: 'กรอกหมายเลขชั้น' }]}>
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
