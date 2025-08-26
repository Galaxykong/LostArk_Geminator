import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

function SupportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden">
        <div className="p-5 border-b">
          <div className="text-lg font-semibold">후원하기</div>
          <div className="text-xs text-gray-500 mt-1">아래 QR을 스캔해서 송금해 주세요.</div>
        </div>
        <div className="p-5 flex flex-col items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}qr.png`} alt="후원 QR" className="w-64 h-64 object-contain rounded-lg border"
              onError={(e)=>{ (e.currentTarget as HTMLImageElement).alt="QR 이미지를 불러오지 못했습니다. "; }}
            />

        </div>
        <div className="px-5 pb-5 flex gap-2">
          <a
            href={`${import.meta.env.BASE_URL}qr.png`}
            download
            className="flex-1 inline-flex items-center justify-center rounded-xl border px-4 py-2 hover:bg-gray-50"
          >
            이미지 저장
          </a>
          <button
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center rounded-xl bg-emerald-600 text-white px-4 py-2 hover:bg-emerald-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function Root() {
  const [showSupport, setShowSupport] = React.useState(false);
  return (
    <React.StrictMode>
      <App />
      {/* Floating support button — opens QR modal */}
      <button
        onClick={() => setShowSupport(true)}
        className="support-btn inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-4 py-2 shadow hover:bg-emerald-700"
      >
        <span>💚 후원하기</span>
      </button>
      <SupportModal open={showSupport} onClose={() => setShowSupport(false)} />
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />)
