import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { animate } from 'animejs';
import { Button } from 'antd';
import { ItemLabel, useItemImages } from '../shared/ItemVisual';

type Props = { product: string; productName: string; machine?: string; machineName?: string; ingredients: string[] };
export function CraftWorkshop({ product, productName, machine, machineName, ingredients }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ play: () => void; pause: () => void; reset: () => void }>();
  const [playing, setPlaying] = useState(false);
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const images = useItemImages([...ingredients, product, machine ?? '']);
  const imageKey = JSON.stringify(images);
  const ingredientKey = JSON.stringify(ingredients);
  useEffect(() => {
    if (!host.current) return;
    let disposed = false;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setFailed(true); return; }
    setFailed(false); setPlaying(false); setProgress(0); setPhase(0);
    const container = host.current;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'โต๊ะคราฟ 3D ลากเพื่อหมุนดู');
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 100);
    camera.position.set(9, 10, 12);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, .7, 0);
    controls.enablePan = false; controls.enableZoom = false;
    controls.minPolarAngle = .35; controls.maxPolarAngle = 1.35;
    controls.update();
    const render = () => { if (!disposed) renderer.render(scene, camera); };
    controls.addEventListener('change', render);
    scene.add(new THREE.HemisphereLight(0xe6f3ff, 0x8898a0, 2.8));
    const sun = new THREE.DirectionalLight(0xfff3da, 4);
    sun.position.set(-3, 9, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
    sun.shadow.bias = -.001; scene.add(sun);
    const blue = new THREE.DirectionalLight(0x9edaff, 2); blue.position.set(6, 4, -5); scene.add(blue);
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    const mat = (color: number, metalness = 0) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .42, metalness }); materials.push(m); return m; };
    const ivory = mat(0xf2f0e9), coral = mat(0xef754e), dark = mat(0x35465a), mint = mat(0x86c7bb), gold = mat(0xffc65b, .3);
    const box = (parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, radius = .08) => {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), material);
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const cylinder = (parent: THREE.Object3D, radius: number, height: number, x: number, y: number, z: number, material: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 48), material);
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    box(scene, 11, .5, 5.4, 0, -.25, 0, ivory, .2);
    box(scene, 10.7, .13, 5.1, 0, .06, 0, mint);
    for (const x of [-4.3, 4.3]) for (const z of [-1.8, 1.8]) box(scene, .35, .65, .35, x, -.75, z, dark);
    // Two real conveyor belts with moving slats.
    const slats: THREE.Mesh[] = [];
    for (const sign of [-1, 1]) {
      box(scene, 3.5, .3, 1.5, sign * 3.1, .4, 0, dark);
      for (const z of [-.85, .85]) box(scene, 3.7, .13, .1, sign * 3.1, .7, z, gold);
      for (let i = 0; i < 15; i++) slats.push(box(scene, .16, .08, 1.25, sign * 3.1 - 1.5 + i * .22, .6, 0, ivory, .02));
      for (const x of [sign * 3.1 - 1.3, sign * 3.1 + 1.3]) box(scene, .15, .35, 1.2, x, .2, 0, dark);
    }
    const machineBody = new THREE.Group(); scene.add(machineBody);
    cylinder(machineBody, 1.2, .25, 0, .28, 0, dark);
    cylinder(machineBody, 1.05, 1.8, 0, 1.25, 0, coral);
    cylinder(machineBody, 1.16, .18, 0, 2.17, 0, ivory);
    const lid = cylinder(machineBody, .9, .24, 0, 2.42, 0, gold);
    box(machineBody, .95, .6, .12, 0, 1.45, 1, dark);
    const screen = box(machineBody, .73, .32, .05, 0, 1.48, 1.09, mint);
    for (let i = 0; i < 3; i++) cylinder(machineBody, .09, .08, -.3 + i * .3, 2.62, 0, dark);
    cylinder(machineBody, .17, 1.3, .65, 2.7, -.5, dark);
    cylinder(machineBody, .27, .15, .65, 3.4, -.5, gold);
    const rotor = new THREE.Group(); rotor.position.set(0, 2.66, 0); machineBody.add(rotor);
    for (let i = 0; i < 4; i++) { const blade = box(rotor, .55, .08, .15, Math.cos(i * Math.PI / 2) * .45, 0, Math.sin(i * Math.PI / 2) * .45, dark); blade.rotation.y = -i * Math.PI / 2; }
    const loader = new THREE.TextureLoader();
    function token(id: string, index: number) {
      const group = new THREE.Group();
      box(group, .66, .55, .66, 0, 0, 0, ivory);
      const url = images[id];
      if (url) {
        const texture = loader.load(url, () => { if (disposed) texture.dispose(); else render(); }, undefined, () => {});
        texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
        const face = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }); materials.push(face);
        const sprite = new THREE.Sprite(face); sprite.position.y = .5; sprite.scale.set(.9, .9, 1); group.add(sprite);
      } else box(group, .3, .3, .3, 0, .45, 0, index % 2 ? coral : gold);
      scene.add(group); return group;
    }
    const tokens = ingredients.map((id, index) => token(id, index));
    const output = token(product, 0);
    output.visible = false;
    const sparks: THREE.Mesh[] = [];
    for (let i = 0; i < 20; i++) { const spark = new THREE.Mesh(new THREE.OctahedronGeometry(.065), gold); spark.visible = false; scene.add(spark); sparks.push(spark); }
    // Floor bolts and a finished-product tray give the scene a toy workshop scale.
    for (const x of [-4.9, 4.9]) for (const z of [-2.1, 2.1]) cylinder(scene, .09, .05, x, .16, z, dark);
    box(scene, 1.35, .12, 1.5, 4.5, .76, 0, coral);
    const motion = { t: 0 };
    let tween: ReturnType<typeof animate> | undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    function draw() {
      const t = motion.t;
      tokens.forEach((token, i) => {
        const start = ingredients.length > 1 ? i / (ingredients.length - 1) * .2 : 0;
        const travel = Math.min(1, Math.max(0, (t - start) / .34));
        token.position.set(-4.2 + travel * 4.2, 1 + Math.sin(travel * Math.PI) * .2, (i % 3 - 1) * .28);
        token.rotation.y = travel * Math.PI;
        token.visible = travel < .98;
      });
      const working = t > .42 && t < .74;
      machineBody.rotation.z = working ? Math.sin(t * 230) * .025 : 0;
      lid.position.y = 2.42 + (working ? Math.abs(Math.sin(t * 100)) * .16 : 0);
      rotor.rotation.y = t * Math.PI * 18;
      screen.scale.x = working ? .8 + Math.sin(t * 100) * .2 : 1;
      slats.forEach((slat, i) => { const sign = i < 15 ? -1 : 1; slat.position.x = sign * 3.1 - 1.5 + ((i % 15) * .22 + t * 8) % 3.3; });
      const out = Math.max(0, (t - .74) / .26);
      output.visible = t >= .74;
      output.position.set(out * 4.4, 1.15 + Math.sin(out * Math.PI) * .65, 0);
      output.rotation.y = out * Math.PI * 2;
      output.scale.setScalar(.55 + Math.min(1, out * 4) * .65);
      sparks.forEach((spark, i) => { const burst = Math.max(0, (t - .7) / .3); spark.visible = t > .7 && t < .99; const angle = i * 2.4; spark.position.set(Math.cos(angle) * burst * 2.5, 2.5 + Math.sin(burst * Math.PI) * 1.6 - i % 3 * .12, Math.sin(angle) * burst * 2.5); spark.scale.setScalar(1 - burst); });
      setProgress(Math.round(t * 100)); setPhase(t < .42 ? 0 : t < .74 ? 1 : 2);
      render();
    }
    api.current = {
      play: () => {
        if (reduced.matches) { motion.t = 1; draw(); setPlaying(false); return; }
        if (motion.t >= 1) motion.t = 0;
        tween?.pause(); setPlaying(true);
        tween = animate(motion, { t: 1, duration: (1 - motion.t) * 6500, ease: 'linear', onUpdate: draw, onComplete: () => setPlaying(false) });
      },
      pause: () => { tween?.pause(); setPlaying(false); },
      reset: () => { camera.position.set(9, 10, 12); controls.target.set(0, .7, 0); controls.update(); render(); },
    };
    const visibility = () => { if (document.hidden) api.current?.pause(); };
    document.addEventListener('visibilitychange', visibility);
    const resize = new ResizeObserver(() => {
      const w = container.clientWidth, h = container.clientHeight;
      const aspect = w / Math.max(1, h), view = aspect < 1.2 ? 7 / aspect : 5.5;
      camera.left = -view * aspect; camera.right = view * aspect; camera.top = view; camera.bottom = -view; camera.updateProjectionMatrix();
      renderer.setSize(w, h); render();
    });
    resize.observe(container); draw();
    return () => {
      disposed = true; tween?.cancel(); resize.disconnect(); controls.dispose(); document.removeEventListener('visibilitychange', visibility);
      scene.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); renderer.dispose(); renderer.domElement.remove(); api.current = undefined;
    };
  // Serialized keys keep the scene stable while quantities and status text change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, machine, imageKey, ingredientKey]);
  return <section className="craft-workshop" aria-label="โรงงานคราฟสามมิติ">
    <div className="craft-workshop__top"><span><i /> โต๊ะทดลอง</span><button onClick={() => api.current?.reset()}>↺ คืนมุมกล้อง</button></div>
    <div className="craft-workshop__canvas" ref={host} />
    {failed && <div className="craft-workshop__fallback">อุปกรณ์นี้เปิดฉาก 3D ไม่ได้ ดูสูตรและวัตถุดิบด้านล่างได้ตามปกติ</div>}
    <div className="craft-workshop__caption"><ItemLabel id={machine} name={machineName ?? 'เครื่องคราฟจำลอง'} size={32} reserveImage /><span>ลากฉากเพื่อหมุนดู · โมเดลจำลองวิธีคราฟ</span></div>
    <div className="craft-workshop__sequence">{['ใส่วัตถุดิบ', 'เครื่องกำลังทำงาน', `ได้${productName}`].map((text, i) => <span key={i} className={i === phase ? 'is-current' : ''}><b>{i + 1}</b>{text}</span>)}</div>
    <div className="craft-workshop__footer"><Button type="primary" size="large" disabled={failed} onClick={() => playing ? api.current?.pause() : api.current?.play()}>{playing ? 'Ⅱ หยุดชั่วคราว' : progress >= 100 ? '↻ คราฟอีกรอบ' : progress > 0 ? '▶ เล่นต่อ' : '▶ ลองคราฟ'}</Button><div><div className="craft-workshop__progress"><span style={{ width: `${progress}%` }} /></div><small role="status">{progress === 100 ? 'เสร็จแล้ว! ' : `${progress}% · `}ภาพจำลองเท่านั้น ไม่หักสต็อก</small></div></div>
  </section>;
}
