import { ItemLabel, ItemThumbnail, ItemVisualProvider, itemSelectVisuals } from '../shared/ItemVisual';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Form, InputNumber, Modal, Select, Spin, Tag, message } from 'antd';
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
  const [selected, setSelected] = useState<FloorTimer | null>(null);
  const [configuring, setConfiguring] = useState<FloorTimer | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [timerForm] = Form.useForm<{ hours: number; minutes: number; seconds: number }>();
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

  const start = async () => {
    const values = await timerForm.validateFields();
    if (!selected) return;
    const duration = (values.hours || 0) * 3600 + (values.minutes || 0) * 60 + (values.seconds || 0);
    if (!duration) { timerForm.setFields([{ name: 'seconds', errors: ['ตั้งเวลาอย่างน้อย 1 วินาที'] }]); return; }
    await patchFloor(selected.floor_number, {
      status: 'running', start_time: new Date().toISOString(), estimated_duration_seconds: duration, completed_at: null,
    }, `เริ่มจับเวลาชั้น ${selected.floor_number} แล้ว`);
    setSelected(null);
  };

  const openTimer = (floor: FloorTimer) => {
    const recipe = recipes.find((item) => item.id === floor.recipe_id);
    const seconds = recipeSeconds(recipe);
    timerForm.setFieldsValue({ hours: Math.floor(seconds / 3600), minutes: Math.floor((seconds % 3600) / 60), seconds: seconds % 60 });
    setSelected(floor);
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
    <div className="floor-dashboard__toolbar">
      <div className="floor-dashboard__legend">
        {(Object.keys(statusMeta) as FloorDisplayStatus[]).map((status) => <span key={status}><i className={`floor-dot floor-dot--${status}`} />{statusMeta[status].label} <b>{counts[status]}</b></span>)}
      </div>
      <Button type="primary" icon={<PlusOutlined />} onClick={openAddFloor}>เพิ่มชั้น</Button>
    </div>

    {loading ? <div className="floor-dashboard__loading"><Spin /><span>กำลังโหลดสถานะชั้น…</span></div> : displayFloors.length === 0 ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีชั้นในระบบ"><Button type="primary" onClick={openAddFloor}>เพิ่มชั้นแรก</Button></Empty>
    ) : <div className="floor-dashboard__grid">
      {displayFloors.map((floor) => {
        const meta = statusMeta[floor.displayStatus];
        const machine = machines.find((item) => item.machine_id === floor.machine_id);
        const machineName = machine?.machine_name;
        const recipe = recipes.find((item) => item.id === floor.recipe_id);
        const finishTime = floor.start_time && floor.estimated_duration_seconds ? new Date(new Date(floor.start_time).getTime() + floor.estimated_duration_seconds * 1000) : null;
        return <Card key={floor.floor_number} className={`floor-card floor-card--${floor.displayStatus}`} size="small">
          <div className="floor-card__head"><div><strong>ชั้น {floor.floor_number}</strong><span><ItemLabel id={floor.profession} name={floor.profession || 'ยังไม่ระบุอาชีพ'} size={16} /></span></div><Tag color={meta.color}>{meta.label}</Tag></div>
          <div className="floor-card__selection">
            <ItemThumbnail id={machine?.machine_id} image={machine?.image} size={32} />
            <div><span>{machineName || 'ยังไม่ได้เลือกเครื่อง'}</span><b>{recipe ? <ItemLabel id={recipe.id} name={recipe.name} image={recipe.image} size={24} /> : 'ยังไม่ได้เลือกสูตร'}</b></div>
          </div>
          <div className="floor-card__body">
            {floor.displayStatus === 'idle' && <><ClockCircleOutlined /><span>พร้อมเริ่มงาน</span></>}
            {floor.displayStatus === 'running' && <><b>{clock(floor.remaining)}</b><span>เสร็จ {finishTime?.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span></>}
            {floor.displayStatus === 'completed' && <><b>เสร็จแล้ว</b><span>เหลือ {clock(floor.remaining)} ก่อนลอย</span></>}
            {floor.displayStatus === 'floating' && <><b>เกินเวลารับงาน</b><span>รีเซ็ตเพื่อเริ่มรอบใหม่</span></>}
          </div>
          <div className="floor-card__actions">
            <Button icon={<SettingOutlined />} onClick={() => openConfig(floor)} aria-label={`ตั้งค่าเครื่องชั้น ${floor.floor_number}`} />
            {floor.displayStatus === 'running' ? <Button icon={<PauseCircleOutlined />} onClick={() => void patchFloor(floor.floor_number, { status: 'idle', start_time: null, estimated_duration_seconds: 0, completed_at: null }, 'หยุดตัวจับเวลาแล้ว')}>หยุด</Button> : <Button type="primary" icon={<PlayCircleOutlined />} disabled={!floor.recipe_id} onClick={() => openTimer(floor)}>เริ่ม</Button>}
            <Button icon={<ReloadOutlined />} onClick={() => void patchFloor(floor.floor_number, { status: 'idle', start_time: null, estimated_duration_seconds: 0, completed_at: null }, 'รีเซ็ตชั้นแล้ว')} />
          </div>
        </Card>;
      })}
    </div>}

    <Modal open={!!selected} onCancel={() => setSelected(null)} onOk={() => void start()} okText="เริ่มทำงาน" okButtonProps={{ loading: saving, icon: <PlayCircleOutlined /> }} cancelText="ยกเลิก" title={`ตั้งเวลาทำงาน — ชั้น ${selected?.floor_number ?? ''}`}>
      <p className="floor-modal-note">ระบบจะแสดง “เสร็จแล้ว” เมื่อหมดเวลา และเปลี่ยนเป็น “ลอย” หลังจากนั้น 15 นาที</p>
      <Form form={timerForm} layout="vertical" initialValues={{ hours: 0, minutes: 30, seconds: 0 }}><div className="floor-time-inputs">
        <Form.Item label="ชั่วโมง" name="hours" rules={[{ required: true }]}><InputNumber min={0} max={99} /></Form.Item>
        <Form.Item label="นาที" name="minutes" rules={[{ required: true }]}><InputNumber min={0} max={59} /></Form.Item>
        <Form.Item label="วินาที" name="seconds" rules={[{ required: true }]}><InputNumber min={0} max={59} /></Form.Item>
      </div></Form>
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
      <Form form={floorForm} layout="vertical"><Form.Item label="หมายเลขชั้น" name="floor_number" rules={[{ required: true, message: 'กรอกหมายเลขชั้น' }]}><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="อาชีพ" name="profession" rules={[{ required: true, message: 'เลือกอาชีพประจำชั้น' }]}>
          <Select placeholder="เลือกอาชีพ" optionLabelProp="label" labelRender={itemSelectVisuals.labelRender} options={professions.map((profession) => ({ value: profession, label: profession, children: <ProfessionOption profession={profession} /> }))} optionRender={(option) => option.data.children} />
        </Form.Item>
      </Form>
    </Modal>
  </div></ItemVisualProvider>;
}
