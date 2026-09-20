// frontend/src/components/UserGuide.tsx
// คู่มือการใช้งาน Factory Resource Calculator (ภาษาไทย)

interface UserGuideProps {
  onClose: () => void;
}

export function UserGuide({ onClose }: UserGuideProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800">📖 คู่มือการใช้งาน</h2>
          <p className="text-xs text-gray-500 mt-0.5">Factory Resource Calculator — ระบบคำนวณทรัพยากรโรงงาน</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
        >
          ← กลับไปคำนวณ
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">

        {/* ภาพรวม */}
        <section>
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="text-2xl">🏭</span> ภาพรวมระบบ
          </h3>
          <div className="bg-white rounded-lg border border-gray-200 p-5 text-sm text-gray-700 leading-relaxed space-y-2">
            <p>
              Factory Resource Calculator คือเครื่องมือช่วยคำนวณทรัพยากรและภาระงานของเครื่องจักรสำหรับ
              <strong> อีเวนต์เกมโรงงาน</strong> โดยรองรับสูตรการผลิตแบบหลายชั้น (Multi-tier BOM)
            </p>
            <p>
              ระบบจะ <strong>ระเบิดสูตรการผลิต</strong> แบบ Recursive ลงไปจนถึงวัตถุดิบดิบ
              แล้วหักลบจากสต็อกที่มีอยู่ เพื่อแสดงรายการที่ต้องจัดหาเพิ่มและชั่วโมงการทำงานของแต่ละเครื่อง
            </p>
          </div>
        </section>

        {/* วิธีใช้งานทีละขั้น */}
        <section>
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">🚀</span> วิธีใช้งานทีละขั้นตอน
          </h3>
          <div className="space-y-4">

            {/* ขั้น 1 */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">1</span>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">เพิ่มไอเทมเป้าหมาย (Target Items)</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    ในแถบซ้าย หัวข้อ <strong>"Add Target Item"</strong> ให้เลือกสินค้าที่ต้องการผลิตจาก Dropdown
                    แล้วกรอกจำนวนในช่องตัวเลข จากนั้นกด <strong>Add</strong>
                  </p>
                  <div className="mt-2 rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
                    💡 สามารถเพิ่มไอเทมได้หลายรายการพร้อมกัน ระบบจะรวมคำนวณทีเดียวในครั้งเดียว
                  </div>
                </div>
              </div>
            </div>

            {/* ขั้น 2 */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">2</span>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">ใส่จำนวนสต็อกที่มีอยู่ (Current Stock)</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    ในหัวข้อ <strong>"Current Stock"</strong> ให้กรอกจำนวนวัตถุดิบและสินค้ากึ่งสำเร็จรูป
                    ที่มีอยู่ในมือ ระบบจะหักลบออกจากที่ต้องผลิตให้อัตโนมัติ
                  </p>
                  <div className="mt-2 rounded-md bg-yellow-50 border border-yellow-100 px-3 py-2 text-xs text-yellow-700">
                    ⚠️ ถ้าไม่มีสต็อกเลย ปล่อยให้เป็น 0 ได้
                  </div>
                </div>
              </div>
            </div>

            {/* ขั้น 3 */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-500 text-white text-sm font-bold flex items-center justify-center">3</span>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">บันทึกสต็อก (Save Stocks)</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    กด <strong>"Save Stocks"</strong> เพื่อบันทึกจำนวนสต็อกลงไฟล์
                    ข้อมูลจะถูกเก็บไว้ให้ไม่ต้องกรอกใหม่ครั้งถัดไป
                  </p>
                </div>
              </div>
            </div>

            {/* ขั้น 4 */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-green-600 text-white text-sm font-bold flex items-center justify-center">4</span>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">กดคำนวณ (Calculate)</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    กดปุ่ม <strong>⚙ Calculate</strong> สีเขียว ระบบจะประมวลผลและแสดงผลลัพธ์
                    ในแผงด้านขวาทันที
                  </p>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* อ่านผลลัพธ์ */}
        <section>
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">📊</span> วิธีอ่านผลลัพธ์
          </h3>
          <div className="space-y-4">

            {/* Shopping List */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                🛒 Shopping List — รายการวัตถุดิบที่ต้องจัดหา
              </h4>
              <div className="text-sm text-gray-600 leading-relaxed space-y-2">
                <p>ตารางแสดงวัตถุดิบทั้งหมดที่ต้องใช้ มี 4 คอลัมน์:</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-gray-200 rounded-md">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">คอลัมน์</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">ความหมาย</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr><td className="px-3 py-2 font-medium">Item Name</td><td className="px-3 py-2 text-gray-600">ชื่อวัตถุดิบ</td></tr>
                      <tr><td className="px-3 py-2 font-medium">Total Needed</td><td className="px-3 py-2 text-gray-600">จำนวนรวมที่ต้องใช้ทั้งหมด (ก่อนหักสต็อก)</td></tr>
                      <tr><td className="px-3 py-2 font-medium">Net Required</td><td className="px-3 py-2 text-gray-600">จำนวนที่ต้องจัดหาเพิ่ม (หลังหักสต็อกแล้ว)</td></tr>
                      <tr><td className="px-3 py-2 font-medium">In Stock</td><td className="px-3 py-2 text-gray-600">จำนวนสต็อกที่มีอยู่ในมือ</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-2 mt-2 rounded-md bg-red-50 border border-red-100 px-3 py-2">
                  <span className="text-red-500 font-bold">⚠</span>
                  <span className="text-xs text-red-700">
                    แถวสีแดง = สต็อกไม่พอ ต้องจัดหาเพิ่ม (<strong>Net Required &gt; In Stock</strong>)
                  </span>
                </div>
              </div>
            </div>

            {/* Machine Workload */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                ⚙ Machine Workload — ภาระงานของเครื่องจักร
              </h4>
              <div className="text-sm text-gray-600 leading-relaxed space-y-2">
                <p>ตารางแสดงเฉพาะเครื่องที่ถูกใช้งานในการคำนวณครั้งนี้ เรียงจากชั่วโมงสูงสุดก่อน:</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-gray-200 rounded-md">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">คอลัมน์</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">ความหมาย</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr><td className="px-3 py-2 font-medium">Status</td><td className="px-3 py-2 text-gray-600">🟢 อยู่ในขีดจำกัด / 🔴 เกินขีดจำกัด</td></tr>
                      <tr><td className="px-3 py-2 font-medium">Machine Name</td><td className="px-3 py-2 text-gray-600">ชื่อเครื่องจักร</td></tr>
                      <tr><td className="px-3 py-2 font-medium">Floor</td><td className="px-3 py-2 text-gray-600">ชั้นที่เครื่องตั้งอยู่</td></tr>
                      <tr><td className="px-3 py-2 font-medium">Hours Required</td><td className="px-3 py-2 text-gray-600">ชั่วโมงที่ต้องใช้ทั้งหมด</td></tr>
                      <tr><td className="px-3 py-2 font-medium">Max Hours</td><td className="px-3 py-2 text-gray-600">ชั่วโมงสูงสุดที่เครื่องรับได้ในอีเวนต์</td></tr>
                      <tr><td className="px-3 py-2 font-medium">Utilization</td><td className="px-3 py-2 text-gray-600">% การใช้งานเทียบกับขีดจำกัด</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-100 px-3 py-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-green-500 flex-shrink-0"></span>
                    <span className="text-xs text-green-700">ชั่วโมง ≤ ขีดจำกัด — เครื่องรับไหว</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-100 px-3 py-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-red-500 flex-shrink-0"></span>
                    <span className="text-xs text-red-700">ชั่วโมง &gt; ขีดจำกัด — เครื่อง Bottleneck!</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* โครงสร้างข้อมูล */}
        <section>
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">🗂️</span> โครงสร้างข้อมูล (สูตรการผลิต BOM)
          </h3>
          <div className="bg-white rounded-lg border border-gray-200 p-5 text-sm text-gray-600 leading-relaxed space-y-3">
            <p>ระบบใช้ไฟล์ JSON ใน <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">backend/data/</code> เก็บข้อมูลทั้งหมด:</p>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 rounded-md bg-gray-50 border border-gray-200">
                <span className="text-lg">📄</span>
                <div>
                  <p className="font-semibold text-gray-700 text-xs font-mono">recipes.json</p>
                  <p className="text-xs text-gray-500 mt-0.5">สูตรการผลิตทุกชิ้น — ระบุเครื่องจักร, เวลาต่อหน่วย, วัตถุดิบที่ต้องใช้</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-md bg-gray-50 border border-gray-200">
                <span className="text-lg">📄</span>
                <div>
                  <p className="font-semibold text-gray-700 text-xs font-mono">machines.json</p>
                  <p className="text-xs text-gray-500 mt-0.5">ข้อมูลเครื่องจักร 27 ชั้น — ชื่อเครื่อง, ชั้น, ชั่วโมงสูงสุด</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-md bg-gray-50 border border-gray-200">
                <span className="text-lg">📄</span>
                <div>
                  <p className="font-semibold text-gray-700 text-xs font-mono">stocks.json</p>
                  <p className="text-xs text-gray-500 mt-0.5">สต็อกปัจจุบัน — บันทึกอัตโนมัติเมื่อกด Save Stocks</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">❓</span> คำถามที่พบบ่อย
          </h3>
          <div className="space-y-3">
            {[
              {
                q: 'ทำไม Net Required ถึงเป็น 0 ทั้งที่ไม่ได้ใส่สต็อก?',
                a: 'อาจเป็นเพราะสินค้ากึ่งสำเร็จรูปในชั้นที่สูงกว่าถูกหักสต็อกออกไปก่อนแล้ว ทำให้ไม่ต้องผลิตวัตถุดิบนั้นเพิ่ม',
              },
              {
                q: 'สามารถเพิ่มไอเทมเป้าหมายซ้ำกันได้ไหม?',
                a: 'ได้ ระบบจะรวมจำนวนของไอเทมเดียวกันในการคำนวณ ไม่มีการ de-dup อัตโนมัติ',
              },
              {
                q: 'ถ้าเครื่องสีแดง ต้องทำอย่างไร?',
                a: 'แปลว่าชั่วโมงที่ต้องใช้เกินขีดจำกัดของอีเวนต์ อาจต้องลดจำนวน Target หรือเพิ่มสต็อกสินค้ากึ่งสำเร็จรูปเพื่อลดภาระเครื่องนั้น',
              },
              {
                q: 'บันทึกสต็อกแล้ว แต่ refresh หน้าแล้วหายไป?',
                a: 'ต้องกด Save Stocks ก่อน หากกด Calculate แล้ว refresh โดยไม่ save ข้อมูลในหน้าจะ reset แต่ไฟล์ stocks.json ยังเก็บไว้อยู่',
              },
              {
                q: 'Backend ไม่ตอบสนอง ทำอย่างไร?',
                a: 'ตรวจสอบว่า backend รันอยู่ที่ port 3000 แล้วหรือไม่ โดยรัน: npm run dev ใน folder backend',
              },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="font-semibold text-gray-800 text-sm mb-1">Q: {item.q}</p>
                <p className="text-sm text-gray-600">A: {item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* วิธีรันระบบ */}
        <section>
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">⚡</span> วิธีเริ่มต้นใช้งาน
          </h3>
          <div className="bg-gray-900 rounded-lg p-5 text-sm font-mono text-green-400 space-y-3">
            <div>
              <p className="text-gray-500 text-xs mb-1"># เปิด Terminal แรก — รัน Backend</p>
              <p>cd backend</p>
              <p>npm run dev</p>
            </div>
            <div className="border-t border-gray-700 pt-3">
              <p className="text-gray-500 text-xs mb-1"># เปิด Terminal ที่สอง — รัน Frontend</p>
              <p>cd frontend</p>
              <p>npm run dev</p>
            </div>
            <div className="border-t border-gray-700 pt-3">
              <p className="text-gray-500 text-xs mb-1"># เปิด Browser</p>
              <p className="text-blue-400">http://localhost:5173</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pb-4">
          Factory Resource Calculator — สร้างสำหรับ Game Event โรงงาน 27 ชั้น
        </div>

      </div> 
    </div>
  );
}
