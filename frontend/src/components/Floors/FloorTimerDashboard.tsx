import './FloorTimerDashboard.css';
import { ItemLabel, ItemVisualProvider, itemSelectVisuals } from '../shared/ItemVisual';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Empty, Form, InputNumber, Modal, Select, Spin, Tag, message } from 'antd';
import { PauseCircleOutlined, PlayCircleOutlined, PlusOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
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
  const [_timerForm] = Form.useForm<{ hours: number; minutes: number; seconds: number }>();  const [configuring, setConfiguring] = useState<FloorTimer | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [_timerForm2] = Form.useForm<{ hours: number; minutes: number; seconds: number }>();
  const [floorForm] = Form.useForm<{ floor_number: number; profession?: string }>();
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

  const addFloor = async () => {
    const values = await floorForm.validateFields();
    if (floors.some((floor) => floor.floor_number === values.floor_number)) {
      floorForm.setFields([{ name: 'floor_number', errors: [`ชั้น ${values.floor_number} มีอยู่ในระบบแล้ว`] }]);
      return;
    }
    setSaving(true);
    try {
      const created = await createFloorTimer(values.floor_number, values.profession);
      setFloors((items) => [...items, created].sort((a, b) => a.floor_number - b.floor_number));
      setAddOpen(false); floorForm.resetFields(); messageApi.success(`เพิ่มชั้น ${created.floor_number} แล้ว`);
    } catch (e) { messageApi.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const openAddFloor = () => {
    const nextFloor = floors.length ? Math.max(...floors.map((floor) => floor.floor_number)) + 1 : 1;
    floorForm.setFieldsValue({ floor_number: nextFloor, profession: undefined });
    setAddOpen(true);
  };

  return <ItemVisualProvider recipes={recipes} machines={machines} stockImages={stockImages}><div className="floor-dashboard">
    {contextHolder}
    {error && <Alert type="error" showIcon message="โหลดข้อมูลชั้นไม่สำเร็จ" description={error} action={<Button size="small" onClick={() => void load()}>ลองอีกครั้ง</Button>} />}

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
      <div className="floor-overview">
        <div className="floor-overview__cells">
          {displayFloors.map((floor) => (
            <button
              key={floor.floor_number}
              className={`floor-overview-cell floor-overview-cell--${floor.displayStatus}`}
              title={`ชั้น ${floor.floor_number} — ${statusMeta[floor.displayStatus].label}`}
              onClick={() => {
                setHighlighted(floor.floor_number);
                document.getElementById(`floor-card-${floor.floor_number}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            >
              {floor.floor_number}
            </button>
          ))}
        </div>
        <p className="floor-overview__hint">คลิกเพื่อไปยังรายละเอียดชั้น</p>
      </div></section>
    )}

    {/* ── Floor cards ── */}
    {loading
      ? <div className="floor-dashboard__loading"><Spin /><span>กำลังโหลดสถานะชั้น…</span></div>
      : displayFloors.length === 0
        ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีชั้นในระบบ"><Button type="primary" onClick={openAddFloor}>เพิ่มชั้นแรก</Button></Empty>
        : <section className="floor-details-panel"><div className="floor-cards-heading"><h3>รายละเอียดชั้น</h3><span>{displayFloors.length} ชั้น</span><Button size="small" icon={<PlusOutlined />} onClick={openAddFloor}>เพิ่มชั้น</Button></div>
            <div className="floor-cards-scroll">
              {displayFloors.map((floor) => {
                const meta = statusMeta[floor.displayStatus];
                const machine = machines.find((m) => m.machine_id === floor.machine_id);
                const recipe = recipes.find((r) => r.id === floor.recipe_id);
                const finishTime = floor.start_time && floor.estimated_duration_seconds
                  ? new Date(new Date(floor.start_time).getTime() + floor.estimated_duration_seconds * 1000) : null;
                const statusImage = { running: 'working', completed: 'completed', floating: 'floating', idle: '' }[floor.displayStatus];
                return (
                  <div id={`floor-card-${floor.floor_number}`} key={floor.floor_number}
                    className={`floor-card2 floor-card2--${floor.displayStatus}${highlighted === floor.floor_number ? " is-highlighted" : ""}`}>
                    {/* Head */}
                    <div className="floor-card2__head">
                      <span className="floor-card2__num">ชั้น {floor.floor_number}</span>
                      <Tag color={meta.color}>{meta.label}</Tag>
                      <Button className="floor-card2__settings" type="text" size="small" aria-label={`ตั้งค่าชั้น ${floor.floor_number}`} icon={<SettingOutlined />} onClick={() => openConfig(floor)} />
                    </div>
                    {/* Machine */}
                    <div className="floor-card2__machine">{machine?.machine_name ?? 'ยังไม่ได้เลือกเครื่อง'}</div>
                    {/* Avatar */}
                    <div className="floor-card2__avatar">
                      {statusImage
                        ? <img src={`/floor-status/${statusImage}.png`} alt={meta.label} />
                        : <PauseCircleOutlined /> }
                    </div>
                    {/* Status */}
                    <div className="floor-card2__status">
                      {floor.displayStatus === 'idle' && <span className="fcs--idle">พร้อมใช้งาน</span>}
                      {floor.displayStatus === 'running' && <><b className="fcs--timer">{clock(floor.remaining)}</b><span className="fcs--sub">เสร็จ {finishTime?.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span></>}
                      {floor.displayStatus === 'completed' && <><b className="fcs--done">เสร็จแล้ว!!</b><span className="fcs--sub">{clock(floor.remaining)} ก่อนลอย</span></>}
                      {floor.displayStatus === 'floating' && <><b className="fcs--float">ลอยแล้วพรี่!!</b><span className="fcs--sub">{clock(finishTime ? Math.max(0, Math.floor((now - finishTime.getTime()) / 1000) - FLOAT_GRACE_SECONDS) : 0)}</span></>}
                    </div>
                    {/* Recipe */}
                    {recipe && <div className="floor-card2__recipe"><ItemLabel id={recipe.id} name={recipe.name} image={recipe.image} size={16} reserveImage /></div>}
                    {/* Actions */}
                    <div className="floor-card2__actions">
                      {floor.displayStatus === 'running'
                        ? <Button className="floor-card2__stop" size="small" icon={<PauseCircleOutlined />} onClick={() => void patchFloor(floor.floor_number, { status: 'idle', start_time: null, estimated_duration_seconds: 0, completed_at: null }, 'หยุดแล้ว')}>หยุด</Button>
                        : <Button size="small" type="primary" icon={<PlayCircleOutlined />} disabled={!floor.recipe_id} loading={saving} onClick={() => void startDirect(floor)}>เริ่ม</Button>}
                      <Button className="floor-card2__reset" size="small" icon={<ReloadOutlined />} onClick={() => void patchFloor(floor.floor_number, { status: 'idle', start_time: null, estimated_duration_seconds: 0, completed_at: null }, 'รีเซ็ตแล้ว')}>รีเซ็ต</Button>
                    </div>
                  </div>
                );
              })}
            </div></section>
    }


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
      <Form form={floorForm} layout="vertical"><Form.Item label="หมายเลขชั้น" name="floor_number" rules={[{ required: true, message: 'กรอกหมายเลขชั้น' }]}><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="อาชีพ" name="profession" rules={[{ required: true, message: 'เลือกอาชีพประจำชั้น' }]}>
          <Select placeholder="เลือกอาชีพ" optionLabelProp="label" labelRender={itemSelectVisuals.labelRender} options={professions.map((profession) => ({ value: profession, label: profession, children: <ProfessionOption profession={profession} /> }))} optionRender={(option) => option.data.children} />
        </Form.Item>
      </Form>
    </Modal>
  </div></ItemVisualProvider>;
}
