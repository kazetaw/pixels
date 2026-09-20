/**
 * MigratePanel.tsx
 *
 * UI panel for running the one-shot JSON → Supabase migration.
 * Calls POST /api/migrate (fix name/UUID conflicts) — the heavy
 * initial data import is done via the migration script, but this
 * panel also lets users trigger the conflict-fix migration in-browser.
 *
 * Additionally exposes a "Diagnose" button to see current conflicts
 * without fixing anything.
 */
import { useState } from 'react';
import { diagnose, migrate } from '../../api/client';
import type { DiagnoseResult, MigrateResult } from '../../api/client';

export function MigratePanel() {
  const [diagResult, setDiagResult] = useState<DiagnoseResult | null>(null);
  const [migrateResult, setMigrateResult] = useState<MigrateResult | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [migrateLoading, setMigrateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDiagnose = async () => {
    setDiagLoading(true);
    setError(null);
    setDiagResult(null);
    setMigrateResult(null);
    try {
      const result = await diagnose();
      setDiagResult(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDiagLoading(false);
    }
  };

  const runMigrate = async () => {
    if (!confirm('ต้องการแก้ไข conflict ทั้งหมดใช่ไหม? การกระทำนี้จะแก้ไขข้อมูลในฐานข้อมูล')) return;
    setMigrateLoading(true);
    setError(null);
    setMigrateResult(null);
    try {
      const result = await migrate();
      setMigrateResult(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMigrateLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
        <h3 className="font-semibold text-blue-800 mb-1">🔧 เครื่องมือจัดการข้อมูล</h3>
        <p className="text-sm text-blue-700">
          ตรวจสอบและแก้ไข conflict ระหว่างชื่อ recipe กับ UUID ในฐานข้อมูล
        </p>
      </div>

      {/* Diagnose section */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={runDiagnose}
            disabled={diagLoading || migrateLoading}
            className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {diagLoading ? '🔍 กำลังตรวจสอบ…' : '🔍 ตรวจสอบ Conflict'}
          </button>
          <span className="text-xs text-gray-500">ดูปัญหาโดยไม่แก้ไขข้อมูล</span>
        </div>

        {diagResult && (
          <div className={`rounded-lg border p-4 ${diagResult.isClean ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
            {diagResult.isClean ? (
              <p className="text-sm font-medium text-green-700">✅ ข้อมูลสะอาด ไม่พบ conflict</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-yellow-800">
                  ⚠️ พบ {diagResult.totalConflicts} conflict
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {diagResult.conflicts.map((c, i) => (
                    <div key={i} className="text-xs text-yellow-900 bg-yellow-100 rounded px-2 py-1.5">
                      <span className="font-medium">[{c.type}]</span> {c.description}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Migrate section */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={runMigrate}
            disabled={diagLoading || migrateLoading}
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {migrateLoading ? '⚙️ กำลังแก้ไข…' : '⚙️ แก้ไข Conflict'}
          </button>
          <span className="text-xs text-gray-500">แปลง name keys → UUID ในสต็อกและ ingredients</span>
        </div>

        {migrateResult && (
          <div className={`rounded-lg border p-4 ${migrateResult.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className={`text-sm font-semibold ${migrateResult.ok ? 'text-green-800' : 'text-red-800'}`}>
              {migrateResult.ok ? '✅' : '❌'} {migrateResult.message}
            </p>
            {migrateResult.report.totalChanges > 0 && (
              <div className="mt-2 text-xs text-green-700 space-y-1">
                {migrateResult.report.stocksFixed.length > 0 && (
                  <p>📦 Stock keys แก้ไข: {migrateResult.report.stocksFixed.join(', ')}</p>
                )}
                {migrateResult.report.ingredientsFixed.length > 0 && (
                  <div>
                    <p>🔗 Ingredients แก้ไข:</p>
                    <ul className="ml-4 space-y-0.5">
                      {migrateResult.report.ingredientsFixed.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-700">❌ {error}</p>
        </div>
      )}

      {/* Info box */}
      <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-xs text-gray-500 space-y-1">
        <p className="font-medium text-gray-600">ℹ️ เกี่ยวกับ migration script (ย้ายข้อมูลครั้งแรก)</p>
        <p>การย้ายข้อมูลจาก JSON เข้า Supabase ครั้งแรกต้องรันผ่าน Terminal:</p>
        <pre className="bg-gray-100 rounded p-2 text-xs overflow-x-auto mt-1">{`SUPABASE_URL=https://xxx.supabase.co \\
SUPABASE_SERVICE_ROLE_KEY=eyJ... \\
npx tsx scripts/migrate-to-supabase.ts`}</pre>
      </div>
    </div>
  );
}
