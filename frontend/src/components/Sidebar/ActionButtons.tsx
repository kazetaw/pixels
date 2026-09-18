import { SaveStatus } from '../../hooks/useAppState';

interface ActionButtonsProps {
  onSaveStocks: () => Promise<void>;
  onCalculate: () => Promise<void>;
  saving: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  loading: boolean;
  canCalculate: boolean;
}

function Spinner() {
  return (
    <svg
      className="inline h-4 w-4 animate-spin text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function ActionButtons({
  onSaveStocks,
  onCalculate,
  saveStatus,
  saveError,
  loading,
  canCalculate,
}: ActionButtonsProps) {
  return (
    <div className="space-y-2">
      {/* Save Stocks button */}
      <button
        onClick={onSaveStocks}
        disabled={saveStatus === 'saving'}
        className="w-full rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saveStatus === 'saving' ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner /> กำลังบันทึก…
          </span>
        ) : (
          'บันทึกสต็อก'
        )}
      </button>

      {/* Save status feedback */}
      {saveStatus === 'saved' && (
        <p className="text-xs text-green-600 text-center">✓ บันทึกสต็อกสำเร็จ</p>
      )}
      {saveStatus === 'error' && (
        <p className="text-xs text-red-600 text-center">{saveError ?? 'บันทึกสต็อกไม่สำเร็จ'}</p>
      )}

      {/* Calculate button */}
      <button
        onClick={onCalculate}
        disabled={!canCalculate || loading}
        className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner /> กำลังคำนวณ…
          </span>
        ) : (
          '⚙ คำนวณ'
        )}
      </button>
    </div>
  );
}
