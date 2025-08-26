// src/main.tsx (전체 교체)
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

/** 후원 모달 */
function SupportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden">
        <div className="p-5 border-b">
          <div className="text-lg font-semibold">후원하기</div>
          <div className="text-xs text-gray-500 mt-1">소중한 골드 감사드립니다♡ </div>
        </div>
        <div className="p-5 flex flex-col items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}QR.png`}
            alt="후원 QR"
            className="w-64 h-64 object-contain rounded-lg border"
            onError={(e) => { (e.currentTarget as HTMLImageElement).alt = "이미지를 불러오지 못했습니다."; }}
          />
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <a
            href={`${import.meta.env.BASE_URL}QR.png`}
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

/** 사용설명서 모달 — 워드의 강조(색/굵기) 느낌을 Tailwind로 반영 */
function ManualModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between">
          <div className="text-lg font-semibold">사용설명서</div>
          <button
            onClick={onClose}
            className="inline-flex items-center rounded-xl bg-indigo-600 text-white px-3 py-1.5 text-sm hover:bg-indigo-700"
            title="닫기"
          >
            닫기
          </button>
        </div>

        {/* Body */}
        <div className="p-6 text-sm text-gray-800 max-h-[70vh] overflow-y-auto space-y-6">
          {/* 사용법 */}
          <section>
            <h3 className="text-lg font-extrabold text-gray-900 text-center mb-2">📘 사용법</h3>
            <ul className="list-disc list-inside space-y-2 leading-relaxed">
              <li>
                상단에서{' '}
                <span className="font-bold text-red-600">가공할 젬의 수치</span>와{' '}
                <span className="font-bold text-red-600">목표치</span>,{' '}
                <span className="font-bold">4가지 가공옵션</span>을 세팅합니다.
              </li>
              <li>
                <span className="text-blue-600 font-semibold">보조 효과 목표 포함하기</span>를 체크하면
                보조 효과 목표도 설정됩니다.{' '}
                <span className="font-bold text-gray-700">(5/5 고정)</span>
              </li>
              <li>
                아래 <span className="font-extrabold text-red-600">확률 계산하기</span>를 누르면{' '}
                <span className="font-bold text-red-600">가공 성공 확률</span>이 표시되고,{' '}
                <span className="font-bold text-red-600">현재 상태에서의 평균 기댓값</span>과 비교해
                <span className="font-bold"> 가공/리롤 추천</span>을 제공합니다.
              </li>
              <li>
                가공 후, <span className="font-semibold">4) 시뮬레이션 진행</span> 영역에서{' '}
                <span className="font-bold">적용된 옵션</span>을 선택하면 결과가 상단에 반영됩니다.
              </li>
            </ul>
          </section>

          {/* 주의사항 */}
          <section>
            <h3 className="text-lg font-extrabold text-rose-600 text-center mb-2">⚠ 주의사항</h3>
            <ul className="list-disc list-inside space-y-2 leading-relaxed">
              <li>
  <span className="font-bold text-green-600">고급</span>/
  <span className="font-bold text-blue-600">희귀</span> 젬은{' '}
  <span className="text-red-600 font-semibold">“중단 추천”</span>이 뜨면{' '}
  <span className="font-bold">바로 중단</span>하는 편이{' '}
  <span className="font-bold">기댓값상 유리</span>합니다.
</li>
              <li>
                <span className="font-bold text-purple-600">영웅 젬</span>은 젬 자체가 귀하므로{' '}
                <span className="font-semibold text-blue-600">초기화권을 사용하거나</span> {' '}
                <span className="font-bold">본인 판단하에 진행하는 것</span>을 권장합니다.
              </li>
              <li>
                이미 <span className="font-semibold">가공이 망한 상태</span>라면, 가공 추천은 의미가
                없을 수 있습니다. 하지만 <span className="text-red-600 font-semibold">도박은 본인 선택</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Root() {
  const [showSupport, setShowSupport] = React.useState(false);
  const [showManual, setShowManual] = React.useState(false);

  return (
    <React.StrictMode>
      <App />

      {/* Floating buttons (오른쪽 하단) */}
      <div className="support-btn flex flex-col items-end gap-2">
        <button
          onClick={() => setShowManual(true)}
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 text-white px-4 py-2 shadow hover:bg-indigo-700"
          title="사용설명서 열기"
        >
          📖 사용설명서
        </button>

        <button
          onClick={() => setShowSupport(true)}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-4 py-2 shadow hover:bg-emerald-700"
          title="후원하기"
        >
          💚 후원하기
        </button>
      </div>

      {/* Modals */}
      <ManualModal open={showManual} onClose={() => setShowManual(false)} />
      <SupportModal open={showSupport} onClose={() => setShowSupport(false)} />
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />)
