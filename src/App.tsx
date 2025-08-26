import React, { useMemo, useState } from "react";

// ----------------------------------------------
// Gem 가공 확률 계산기 (완성본) — Paste-ready App.tsx
// - Tailwind UI 래퍼 포함 (min-h-screen / max-w-6xl)
// - 프리셋(공격A&B=5 / 서포트A&B=5), 이름-슬롯 스왑, 리롤 락(첫 가공 전 금지)
// - 가속 근사(가중치 기대값) 적용으로 빠른 계산
// ----------------------------------------------

// ================ 모델 타입 ================

type EffectKind =
  | "WE_PLUS"
  | "WE_MINUS1"
  | "PT_PLUS"
  | "PT_MINUS1"
  | "O1_PLUS"
  | "O1_MINUS1"
  | "O2_PLUS"
  | "O2_MINUS1"
  | "O1_CHANGE"
  | "O2_CHANGE"
  | "COST_UP"
  | "COST_DOWN"
  | "HOLD"
  | "REROLL_PLUS";

// REROLL_PLUS는 +1 또는 +2를 amount로 구분
interface Effect {
  id: string;
  label: string;
  kind: EffectKind;
  plusTier?: 1 | 2 | 3 | 4; // *_PLUS 전용
  amount?: 1 | 2; // REROLL_PLUS 전용
  delta?: -1; // *_MINUS1 전용
  baseProb: number; // 문서 상 확률(%)
}

const E: Effect[] = [
  // 의지력 효율
  { id: "WE+1", label: "의지력 효율 +1", kind: "WE_PLUS", plusTier: 1, baseProb: 11.65 },
  { id: "WE+2", label: "의지력 효율 +2", kind: "WE_PLUS", plusTier: 2, baseProb: 4.4 },
  { id: "WE+3", label: "의지력 효율 +3", kind: "WE_PLUS", plusTier: 3, baseProb: 1.75 },
  { id: "WE+4", label: "의지력 효율 +4", kind: "WE_PLUS", plusTier: 4, baseProb: 0.45 },
  { id: "WE-1", label: "의지력 효율 -1", kind: "WE_MINUS1", delta: -1, baseProb: 3.0 },
  // 포인트
  { id: "PT+1", label: "포인트 +1", kind: "PT_PLUS", plusTier: 1, baseProb: 11.65 },
  { id: "PT+2", label: "포인트 +2", kind: "PT_PLUS", plusTier: 2, baseProb: 4.4 },
  { id: "PT+3", label: "포인트 +3", kind: "PT_PLUS", plusTier: 3, baseProb: 1.75 },
  { id: "PT+4", label: "포인트 +4", kind: "PT_PLUS", plusTier: 4, baseProb: 0.45 },
  { id: "PT-1", label: "포인트 -1", kind: "PT_MINUS1", delta: -1, baseProb: 3.0 },
  // 첫번째 효과(옵션1 이름 기준)
  { id: "O1+1", label: "첫번째 효과 Lv. +1", kind: "O1_PLUS", plusTier: 1, baseProb: 11.65 },
  { id: "O1+2", label: "첫번째 효과 Lv. +2", kind: "O1_PLUS", plusTier: 2, baseProb: 4.4 },
  { id: "O1+3", label: "첫번째 효과 Lv. +3", kind: "O1_PLUS", plusTier: 3, baseProb: 1.75 },
  { id: "O1+4", label: "첫번째 효과 Lv. +4", kind: "O1_PLUS", plusTier: 4, baseProb: 0.45 },
  { id: "O1-1", label: "첫번째 효과 Lv. -1", kind: "O1_MINUS1", delta: -1, baseProb: 3.0 },
  // 두번째 효과(옵션2 이름 기준)
  { id: "O2+1", label: "두번째 효과 Lv. +1", kind: "O2_PLUS", plusTier: 1, baseProb: 11.65 },
  { id: "O2+2", label: "두번째 효과 Lv. +2", kind: "O2_PLUS", plusTier: 2, baseProb: 4.4 },
  { id: "O2+3", label: "두번째 효과 Lv. +3", kind: "O2_PLUS", plusTier: 3, baseProb: 1.75 },
  { id: "O2+4", label: "두번째 효과 Lv. +4", kind: "O2_PLUS", plusTier: 4, baseProb: 0.45 },
  { id: "O2-1", label: "두번째 효과 Lv. -1", kind: "O2_MINUS1", delta: -1, baseProb: 3.0 },
  // 변경/비용/상태/리롤
  { id: "O1chg", label: "첫번째 효과 변경", kind: "O1_CHANGE", baseProb: 3.25 },
  { id: "O2chg", label: "두번째 효과 변경", kind: "O2_CHANGE", baseProb: 3.25 },
  { id: "COST+100", label: "가공 비용 +100% 증가", kind: "COST_UP", baseProb: 1.75 },
  { id: "COST-100", label: "가공 비용 -100% 감소", kind: "COST_DOWN", baseProb: 1.75 },
  { id: "HOLD", label: "가공 상태 유지", kind: "HOLD", baseProb: 1.75 },
  { id: "REROLL+1", label: "다른 항목 보기 +1회", kind: "REROLL_PLUS", amount: 1, baseProb: 2.5 },
  { id: "REROLL+2", label: "다른 항목 보기 +2회", kind: "REROLL_PLUS", amount: 2, baseProb: 0.75 },
];

// ================ 유틸 ================
const clamp15 = (x: number) => Math.min(5, Math.max(1, x));
const clampCost = (x: number) => Math.min(100, Math.max(-100, x));
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const avg = (arr: number[]) => (arr.length ? sum(arr) / arr.length : 0);

// ================ 옵션 타입 ================
const OPTION_TYPES = ["공격형 A", "공격형 B", "서포트형 A", "서포트형 B"] as const;
type OptionType = typeof OPTION_TYPES[number];

type GoalPreset = "없음" | "공격형 A&B 5" | "서포트형 A&B 5";

// ================ 상태/타깃 ================
interface Targets {
  we: number; // 목표 의지력 효율 (1~5)
  pt: number; // 목표 포인트 (1~5)
  includeOptions: boolean;
  target1Type?: OptionType; // 목표 옵션 타입 1 (프리셋 사용 시 강제 지정)
  target1Val?: number;      // 목표 옵션 값 1 (항상 5)
  target2Type?: OptionType; // 목표 옵션 타입 2 (항상 짝 타입)
  target2Val?: number;      // 목표 옵션 값 2 (항상 5)
}

// sw=true면 이름-슬롯 매핑이 스왑된 상태
// costAdj: -100 ~ +100
interface State { we: number; pt: number; o1: number; o2: number; sw: boolean; costAdj: number; t1Type: OptionType; t2Type: OptionType; }

// 현재 이름 기준 값 (효과 적용용)
function currentNameValues(s: State) {
  return { v1: s.sw ? s.o2 : s.o1, v2: s.sw ? s.o1 : s.o2 };
}

// 타입 기준 현재 값 (성공 판단용)
function valueByTypeDyn(s: State, t: OptionType): number | null {
  if (t === s.t1Type) return s.o1;
  if (t === s.t2Type) return s.o2;
  return null; // 현재 젬에 없는 타입이면 달성 불가
}

// 목표 달성(타입 기준)
function isSuccess(s: State, tg: Targets): boolean {
  if (s.we < tg.we || s.pt < tg.pt) return false;
  if (!tg.includeOptions) return true;

  const checkOne = (ty?: OptionType, val?: number) => {
    if (!ty || !val) return true; // 미설정이면 통과
    const v = valueByTypeDyn(s, ty);
    return v !== null && v >= val;
  }
;

  return checkOne(tg.target1Type, tg.target1Val) && checkOne(tg.target2Type, tg.target2Val);
}

// 미등장 조건 체크 → 가중치(0 또는 baseProb) 반환 (이름 기준 수치 사용)
function weightIfEligible(eff: Effect, s: State, attemptsLeft: number): number {
  const { v1, v2 } = currentNameValues(s);
  switch (eff.kind) {
    case "WE_PLUS": {
      const tier = eff.plusTier!; // 1~4
      if (tier === 1 && s.we === 5) return 0;
      if (tier === 2 && s.we >= 4) return 0;
      if (tier === 3 && s.we >= 3) return 0;
      if (tier === 4 && s.we >= 2) return 0;
      return eff.baseProb;
    }
    case "WE_MINUS1":
      return s.we === 1 ? 0 : eff.baseProb;
    case "PT_PLUS": {
      const tier = eff.plusTier!;
      if (tier === 1 && s.pt === 5) return 0;
      if (tier === 2 && s.pt >= 4) return 0;
      if (tier === 3 && s.pt >= 3) return 0;
      if (tier === 4 && s.pt >= 2) return 0;
      return eff.baseProb;
    }
    case "PT_MINUS1":
      return s.pt === 1 ? 0 : eff.baseProb;
    case "O1_PLUS": {
      const tier = eff.plusTier!;
      if (tier === 1 && v1 === 5) return 0;
      if (tier === 2 && v1 >= 4) return 0;
      if (tier === 3 && v1 >= 3) return 0;
      if (tier === 4 && v1 >= 2) return 0;
      return eff.baseProb;
    }
    case "O1_MINUS1":
      return v1 === 1 ? 0 : eff.baseProb;
    case "O2_PLUS": {
      const tier = eff.plusTier!;
      if (tier === 1 && v2 === 5) return 0;
      if (tier === 2 && v2 >= 4) return 0;
      if (tier === 3 && v2 >= 3) return 0;
      if (tier === 4 && v2 >= 2) return 0;
      return eff.baseProb;
    }
    case "O2_MINUS1":
      return v2 === 1 ? 0 : eff.baseProb;
    case "COST_UP":
      return (s.costAdj >= 100 || attemptsLeft === 1) ? 0 : eff.baseProb;
    case "COST_DOWN":
      return (s.costAdj <= -100 || attemptsLeft === 1) ? 0 : eff.baseProb;
    case "REROLL_PLUS":
      return attemptsLeft === 1 ? 0 : eff.baseProb;
    case "O1_CHANGE":
    case "O2_CHANGE":
    case "HOLD":
      return eff.baseProb;
  }
}

// 가중치 기반 비복원 샘플링 (4개)
function sample4WeightedIndices(state: State, attemptsLeft: number): number[] {
  const weights = E.map((eff) => weightIfEligible(eff, state, attemptsLeft));
  const picks: number[] = [];
  const weightsMutable = [...weights];
  for (let k = 0; k < 4; k++) {
    const total = sum(weightsMutable);
    if (total <= 0) break; // 비정상 상황 (모두 불가)
    let r = Math.random() * total;
    let chosen = -1;
    for (let i = 0; i < weightsMutable.length; i++) {
      const w = weightsMutable[i];
      if (w <= 0) continue;
      if (r < w) { chosen = i; break; }
      r -= w;
    }
    if (chosen === -1) break;
    picks.push(chosen);
    weightsMutable[chosen] = 0; // 비복원
  }
  // 보호: 4개 미만일 경우 유효한 나머지로 채움
  if (picks.length < 4) {
    const rest = weights
      .map((w, i) => ({ w, i }))
      .filter((x) => x.w > 0 && !picks.includes(x.i))
      .map((x) => x.i)
      .slice(0, 4 - picks.length);
    picks.push(...rest);
  }
  return picks.sort((a, b) => a - b);
}

// (가속) 4개 후보의 평균을 MC 대신 가중치 기대값으로 근사
function weightedMeanF(s: State, attemptsLeft: number, fAll: number[]): number {
  const ws = E.map((eff) => weightIfEligible(eff, s, attemptsLeft));
  const total = sum(ws);
  if (total <= 0) return 0;
  let acc = 0;
  for (let i = 0; i < ws.length; i++) acc += ws[i] * fAll[i];
  return acc / total;
}

// 효과 적용 (이름 기준으로 +/−, 변경 시 이름 스왑)
function applyEffect(s: State, eff: Effect, changeTo?: OptionType): { next: State; addToken: number } {
  let { we, pt, o1, o2, sw, costAdj, t1Type, t2Type } = s;
  let addToken = 0;

  const addToName1 = (d: number) => { if (!sw) o1 = clamp15(o1 + d); else o2 = clamp15(o2 + d); };
  const addToName2 = (d: number) => { if (!sw) o2 = clamp15(o2 + d); else o1 = clamp15(o1 + d); };

  switch (eff.kind) {
    case "WE_PLUS":
      we = clamp15(we + (eff.plusTier || 1));
      break;
    case "WE_MINUS1":
      we = clamp15(we - 1);
      break;
    case "PT_PLUS":
      pt = clamp15(pt + (eff.plusTier || 1));
      break;
    case "PT_MINUS1":
      pt = clamp15(pt - 1);
      break;
    case "O1_PLUS":
      addToName1(eff.plusTier || 1);
      break;
    case "O1_MINUS1":
      addToName1(-1);
      break;
    case "O2_PLUS":
      addToName2(eff.plusTier || 1);
      break;
    case "O2_MINUS1":
      addToName2(-1);
      break;
    case "O1_CHANGE": {
      const pool = OPTION_TYPES.filter((t) => t !== t1Type);
      t1Type = changeTo ?? pool[Math.floor(Math.random() * pool.length)];
      break;
    }
    case "O2_CHANGE": {
      const pool = OPTION_TYPES.filter((t) => t !== t2Type);
      t2Type = changeTo ?? pool[Math.floor(Math.random() * pool.length)];
      break;
    }
    case "COST_UP":
      costAdj = clampCost(costAdj + 100);
      break;
    case "COST_DOWN":
      costAdj = clampCost(costAdj - 100);
      break;
    case "HOLD":
      // 변화 없음
      break;
    case "REROLL_PLUS":
      addToken = (eff.amount || 1);
      break;
  }
  return { next: { we, pt, o1, o2, sw, costAdj, t1Type, t2Type }, addToken };
}

// 메모 키 (옵션 타입도 포함)
function keyForMemo(s: State, N: number, C: number, tg: Targets) {
  const optPart = tg.includeOptions ? `|o1:${s.o1}|o2:${s.o2}|sw:${s.sw ? 1 : 0}|t1:${s.t1Type}|t2:${s.t2Type}` : "";
  return `we:${s.we}|pt:${s.pt}${optPart}|cost:${s.costAdj}|N:${N}|C:${C}|incOpt:${tg.includeOptions}|tw:${tg.we}|tp:${tg.pt}|g1:${tg.target1Type ?? "-"}:${tg.target1Val ?? "-"}|g2:${tg.target2Type ?? "-"}:${tg.target2Val ?? "-"}`;
}


// ================ 엔진(DP + 가속 근사) ================
function buildProbabilityEngine(targets: Targets) {
  const memo = new Map<string, number>();

  function P_pre(s: State, N: number, C: number, lockReroll: boolean): number {
    if (isSuccess(s, targets)) return 1;
    if (N <= 0) return 0;

    const k = keyForMemo(s, N, C, targets) + `|lock:${lockReroll ? 1 : 0}`;
    const cached = memo.get(k);
    if (cached !== undefined) return cached;

    // 모든 효과 적용 후 확률(미등장 여부와 무관) 미리 계산
    const fAll: number[] = new Array(E.length);
    for (let i = 0; i < E.length; i++) {
      const eff = E[i];
      if (eff.kind === "O1_CHANGE") {
        const choices = OPTION_TYPES.filter((t) => t !== s.t1Type);
        let acc = 0;
        for (const t of choices) {
          const { next, addToken } = applyEffect(s, eff, t);
          acc += P_pre(next, N - 1, C + addToken, false);
        }
        fAll[i] = acc / choices.length;
      } else if (eff.kind === "O2_CHANGE") {
        const choices = OPTION_TYPES.filter((t) => t !== s.t2Type);
        let acc = 0;
        for (const t of choices) {
          const { next, addToken } = applyEffect(s, eff, t);
          acc += P_pre(next, N - 1, C + addToken, false);
        }
        fAll[i] = acc / choices.length;
      } else {
        const { next, addToken } = applyEffect(s, eff);
        fAll[i] = P_pre(next, N - 1, C + addToken, false);
      }
    }

    // (가속) MC 대신 가중치 기대값으로 세트 평균을 근사
    if (C <= 0 || lockReroll) {
      const val = weightedMeanF(s, N, fAll);
      memo.set(k, val);
      return val;
    }

    // 토큰이 있고 리롤 가능하면: max(현재 세트 기대값, 리롤 기대값)
    const valueIfChange = P_pre(s, N, C - 1, false);
    const rollMean = weightedMeanF(s, N, fAll);
    const val = Math.max(rollMean, valueIfChange);
    memo.set(k, val);
    return val;
  }

  function P_roll_now(s: State, N: number, C: number, currentIdx4: number[]): number {
    if (isSuccess(s, targets)) return 1;
    if (N <= 0) return 0;
    const fAll: number[] = new Array(E.length);
    for (let i = 0; i < E.length; i++) {
      const eff = E[i];
      if (eff.kind === "O1_CHANGE") {
        const choices = OPTION_TYPES.filter((t) => t !== s.t1Type);
        let acc = 0;
        for (const t of choices) {
          const { next, addToken } = applyEffect(s, eff, t);
          acc += P_pre(next, N - 1, C + addToken, false);
        }
        fAll[i] = acc / choices.length;
      } else if (eff.kind === "O2_CHANGE") {
        const choices = OPTION_TYPES.filter((t) => t !== s.t2Type);
        let acc = 0;
        for (const t of choices) {
          const { next, addToken } = applyEffect(s, eff, t);
          acc += P_pre(next, N - 1, C + addToken, false);
        }
        fAll[i] = acc / choices.length;
      } else {
        const { next, addToken } = applyEffect(s, eff);
        fAll[i] = P_pre(next, N - 1, C + addToken, false);
      }
    }
    // 현재 화면의 4개는 실제로 고정되어 있으므로 평균은 그대로 사용
    return avg(currentIdx4.map((i) => fAll[i]));
  }

  return { P_pre, P_roll_now };
}

// ================ 라벨 생성 ================
function labelForEffect(e: Effect, slot1Type: OptionType, slot2Type: OptionType): string {
  switch (e.kind) {
    case "O1_PLUS":
      return `${slot1Type} Lv. +${e.plusTier ?? 1}`;
    case "O1_MINUS1":
      return `${slot1Type} Lv. -1`;
    case "O2_PLUS":
      return `${slot2Type} Lv. +${e.plusTier ?? 1}`;
    case "O2_MINUS1":
      return `${slot2Type} Lv. -1`;
    default:
      return e.label; // WE/PT/비용/상태/리롤 등은 고정 라벨 유지
  }
}

const fmtPct = (x: number) => `${(x * 100).toFixed(2)}%`;

export default function App() {
  // 공통 입력/셀렉트 스타일 (브라우저 기본 스타일 제거 + 예쁜 포커스)
  const inputCls = "w-full mt-1 rounded-xl bg-white ring-1 ring-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";
  const selectCls = inputCls + " appearance-none";
  // 기본 입력값
  const [rarity, setRarity] = useState<"고급" | "희귀" | "영웅">("고급");
  const defaultAttempts = rarity === "고급" ? 5 : rarity === "희귀" ? 7 : 9;
  const defaultTokens = rarity === "고급" ? 0 : rarity === "희귀" ? 1 : 2;
  const [attempts, setAttempts] = useState<number>(defaultAttempts);
  const [tokens, setTokens] = useState<number>(defaultTokens);

  const [we, setWe] = useState<number>(1);
  const [pt, setPt] = useState<number>(1);
  
  // 모바일 입력 개선: 현재 의지력/포인트 입력용 문자열 버퍼
  const [weStr, setWeStr] = useState<string>(String(we));
  const [ptStr, setPtStr] = useState<string>(String(pt));
  React.useEffect(() => { setWeStr(String(we)); }, [we]);
  React.useEffect(() => { setPtStr(String(pt)); }, [pt]);
const [o1, setO1] = useState<number>(1);
  const [o2, setO2] = useState<number>(1);
  const [sw, setSw] = useState<boolean>(false);
  const [costAdj, setCostAdj] = useState<number>(0); // -100~+100

  // 슬롯 타입
  const [slot1Type, setSlot1Type] = useState<OptionType>("공격형 A");
  const [slot2Type, setSlot2Type] = useState<OptionType>("공격형 B");

  // 목표
  const [tWe, setTWe] = useState<number>(5);
  const [tPt, setTPt] = useState<number>(5);
  
  // 모바일에서 숫자 지울 때 '1'로 강제되는 문제 방지용 입력 버퍼
  const [tWeStr, setTWeStr] = useState<string>("5");
  const [tPtStr, setTPtStr] = useState<string>("5");

  // 모델 값이 바뀌면 문자열 버퍼도 동기화 (외부에서 값이 바뀌는 경우 대비)
  React.useEffect(() => { setTWeStr(String(tWe)); }, [tWe]);
  React.useEffect(() => { setTPtStr(String(tPt)); }, [tPt]);
const [includeOptions, setIncludeOptions] = useState<boolean>(false);
  const [goalPreset, setGoalPreset] = useState<GoalPreset>("없음");

  // 현재 화면 4개 (수동 변경 가능)
  const [idx0, setIdx0] = useState<number>(0);
  const [idx1, setIdx1] = useState<number>(1);
  const [idx2, setIdx2] = useState<number>(2);
  const [idx3, setIdx3] = useState<number>(3);

  const currentIdx4 = useMemo(() => {
    const arr = Array.from(new Set([idx0, idx1, idx2, idx3]));
    while (arr.length < 4) {
      const cands = E.map((_, i) => i).filter((i) => !arr.includes(i));
      arr.push(cands[0]);
    }
    return arr.sort((a, b) => a - b);
  }, [idx0, idx1, idx2, idx3]);

  // 레어리티 바뀌면 기본 시도/토큰 갱신 + 첫 가공 상태 리셋
  React.useEffect(() => {
    const v = rarity === "고급" ? 5 : rarity === "희귀" ? 7 : 9;
    const tks = rarity === "고급" ? 0 : rarity === "희귀" ? 1 : 2;
    setAttempts(v);
    setTokens(tks);
    setHasRolled(false);
  }, [rarity]);

  // 목표 프리셋을 Targets에 반영
  const targets: Targets = useMemo(() => {
    let t: Targets = { we: tWe, pt: tPt, includeOptions };
    if (includeOptions) {
      if (goalPreset === "공격형 A&B 5") {
        t = { ...t, target1Type: "공격형 A", target1Val: 5, target2Type: "공격형 B", target2Val: 5 };
      } else if (goalPreset === "서포트형 A&B 5") {
        t = { ...t, target1Type: "서포트형 A", target1Val: 5, target2Type: "서포트형 B", target2Val: 5 };
      }
    }
    return t;
  }, [tWe, tPt, includeOptions, goalPreset]);

  // 엔진 준비
  const engine = useMemo(() => buildProbabilityEngine(targets), [targets]);

  // 계산 결과 및 진행 여부
  const [computed, setComputed] = useState<boolean>(false);
  const [result, setResult] = useState<null | { pRollNow: number; pChangeNow: number; pFromScratch: number; recommend: "roll" | "change" }>(null);
  const [hasRolled, setHasRolled] = useState<boolean>(false);

  const rollVsAllClass = useMemo(() => {
    if (!result) return "text-gray-900";
    if (result.pRollNow > result.pFromScratch) return "text-blue-600";
    if (result.pRollNow < result.pFromScratch) return "text-rose-600";
    return "text-gray-900";
  }, [result]);

  function regenCurrent4Weighted() {
    const s: State = { we, pt, o1, o2, sw, costAdj, t1Type: slot1Type, t2Type: slot2Type };
    const picked = sample4WeightedIndices(s, attempts);
    setIdx0(picked[0] ?? 0);
    setIdx1(picked[1] ?? 1);
    setIdx2(picked[2] ?? 2);
    setIdx3(picked[3] ?? 3);
  }

  function compute() {
    

    const s: State = { we, pt, o1, o2, sw, costAdj, t1Type: slot1Type, t2Type: slot2Type };
    const lock = !hasRolled; // 첫 가공 전에는 리롤 불가
    const pRollNow = engine.P_roll_now(s, attempts, tokens, currentIdx4);
    const pChangeNow = tokens > 0 && !lock ? engine.P_pre(s, attempts, tokens - 1, false) : 0;
    const pFromScratch = engine.P_pre(s, attempts, tokens, lock);
    const recommend = (!lock && tokens > 0 && pChangeNow > pRollNow) ? "change" : "roll";
    setResult({ pRollNow, pChangeNow, pFromScratch, recommend });
    setComputed(true);
  }

  // 실제 진행: 현재 4개 중 하나 적용
  function applyEffectByIndex(idx: number) {
    if (attempts <= 0) return;
    const s: State = { we, pt, o1, o2, sw, costAdj, t1Type: slot1Type, t2Type: slot2Type };
    const { next, addToken } = applyEffect(s, E[idx]);
    setWe(next.we);
    setPt(next.pt);
    setO1(next.o1);
    setO2(next.o2);
    setSw(next.sw);
    setCostAdj(next.costAdj);
    // 타입 변경(옵션 변경 효과) UI 반영
    setSlot1Type(next.t1Type);
    setSlot2Type(next.t2Type);
    setAttempts((n) => Math.max(0, n - 1));
    if (addToken > 0) setTokens((t) => t + addToken);
    if (!hasRolled) setHasRolled(true);
    regenCurrent4Weighted();
    setTimeout(() => compute(), 0);
  }

  // 리롤 버튼
  function rerollSet() {
    if (tokens <= 0) return;
    if (!hasRolled) return; // 첫 가공 전 리롤 불가
    setTokens((t) => t - 1);
    regenCurrent4Weighted();
    setTimeout(() => compute(), 0);
  }

  // 이름 값 표시(효과 적용 기준)
  const namedO1 = sw ? o2 : o1;
  const namedO2 = sw ? o1 : o2;

  // 프리셋과 슬롯 타입의 불일치 경고 (선택한 목표 타입이 현재 젬 슬롯 타입에 모두 있어야 함)
  const presetMismatch = useMemo(() => {
    if (!includeOptions) return false;
    if (goalPreset === "공격형 A&B 5") return !([slot1Type, slot2Type].includes("공격형 A") && [slot1Type, slot2Type].includes("공격형 B"));
    if (goalPreset === "서포트형 A&B 5") return !([slot1Type, slot2Type].includes("서포트형 A") && [slot1Type, slot2Type].includes("서포트형 B"));
    return false;
  }, [includeOptions, goalPreset, slot1Type, slot2Type]);

  // 드롭다운용 옵션 라벨(슬롯 타입 반영)
  const effectOptions = useMemo(() => (
    E.map((e, i) => ({ value: i, label: labelForEffect(e, slot1Type, slot2Type) }))
  ), [slot1Type, slot2Type]);

  // 목표 조정 시 자동 재계산(최초 1회 계산 이후)
  React.useEffect(() => { if (computed) compute(); }, [tWe, tPt, includeOptions, goalPreset, slot1Type, slot2Type]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6 font-sans antialiased">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-3"> 로스트아크 Gem 가공 확률 계산기 By 갤럭시카드 </h1>
        <p className="text-sm md:text-base text-gray-600 mb-6">
          실제 <b>등장 확률</b>과 <b>미등장 조건</b>을 반영한 가중치 모델로 4개 후보를 생성하고, 선택/리롤 전략까지 고려한 목표 달성 확률을 계산합니다.
        </p>

        {/* 입력 카드들 */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* 좌측: 기본 설정 */}
          <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            <h2 className="text-lg font-semibold">1) 기본 설정</h2>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-sm text-gray-600">젬 등급</label>
                <select className={selectCls}
                  value={rarity}
                  onChange={(e) => setRarity(e.target.value as any)}
                >
                  <option>고급</option>
                  <option>희귀</option>
                  <option>영웅</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">가공 가능 횟수</label>
                <input
                  type="number"
                  className={inputCls}
                  value={attempts}
                  min={0}
                  onChange={(e) => setAttempts(parseInt(e.target.value || "0", 10))}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">가공 효과 변경(리롤) 토큰</label>
                <input
                  type="number"
                  className={inputCls}
                  value={tokens}
                  min={0}
                  onChange={(e) => setTokens(parseInt(e.target.value || "0", 10))}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">비용 보정 (−100 ~ +100)</label>
                <input
                  type="number"
                  className={inputCls}
                  value={costAdj}
                  min={-100}
                  max={100}
                  onChange={(e) => setCostAdj(clampCost(parseInt(e.target.value || "0", 10)))}
                />
              </div>
              <div className="col-span-2">
               <div className="text-xs text-gray-500 border rounded-xl px-3 py-2">
  첫 번째 효과= <b>옵션1</b>, 두 번째 효과= <b>옵션2</b> 로 간주합니다. "효과 변경"은 해당 효과의 <b>타입 변경</b>(수치는 유지)이며, 이후의 +1/+2/+3/+4와 -1은 <b>바뀐 타입의 이름</b>을 따라 적용됩니다. 모든 능력치는 <b>1~5</b> 범위로 유지됩니다.
</div>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-semibold mb-2">효과 옵션</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600">첫번째 효과</label>
                  <select className={selectCls} value={slot1Type} onChange={(e)=>setSlot1Type(e.target.value as OptionType)}>
                    {OPTION_TYPES.map((t)=>(<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600">두번째 효과</label>
                  <select className={selectCls} value={slot2Type} onChange={(e)=>setSlot2Type(e.target.value as OptionType)}>
                    {OPTION_TYPES.map((t)=>(<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-3">
                현재 매핑: '옵션1'→ <b>{sw ? "슬롯2" : "슬롯1"}</b> ({sw ? slot2Type : slot1Type}) / '옵션2'→ <b>{sw ? "슬롯1" : "슬롯2"}</b> ({sw ? slot1Type : slot2Type})
              </div>
            </div>
          </div>

          {/* 우측: 현재 능력치 / 목표 */}
          <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            <h2 className="text-lg font-semibold">2) 현재 능력치 & 목표</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600">현재 의지력 효율</label>
                <input type="number" min={1} max={5} className={inputCls}
                  value={weStr}
                  onChange={(e)=>{
                    const v = e.target.value;
                    if (v === "") { setWeStr(""); return; }
                    const n = parseInt(v, 10);
                    if (Number.isNaN(n)) { return; }
                    if (n >= 1 && n <= 5) { setWeStr(v); setWe(n); }
                    else { setWeStr(v); }
                  }}
                  onBlur={()=>{
                    const n = parseInt(weStr || "1", 10);
                    const c = clamp15(n);
                    setWe(c);
                    setWeStr(String(c));
                  }}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">목표 의지력 효율</label>
                <input type="number" min={1} max={5} className={inputCls}
                  value={tWeStr}
                  onChange={(e)=>{
                    const v = e.target.value;
                    if (v === "") { setTWeStr(""); return; }
                    const n = parseInt(v, 10);
                    if (Number.isNaN(n)) { return; }
                    if (n >= 1 && n <= 5) { setTWeStr(v); setTWe(n); }
                    else { setTWeStr(v); }
                  }}
                  onBlur={()=>{
                    const n = parseInt(tWeStr || "1", 10);
                    const c = clamp15(n);
                    setTWe(c);
                    setTWeStr(String(c));
                  }}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">현재 포인트</label>
                <input type="number" min={1} max={5} className={inputCls}
                  value={ptStr}
                  onChange={(e)=>{
                    const v = e.target.value;
                    if (v === "") { setPtStr(""); return; }
                    const n = parseInt(v, 10);
                    if (Number.isNaN(n)) { return; }
                    if (n >= 1 && n <= 5) { setPtStr(v); setPt(n); }
                    else { setPtStr(v); }
                  }}
                  onBlur={()=>{
                    const n = parseInt(ptStr || "1", 10);
                    const c = clamp15(n);
                    setPt(c);
                    setPtStr(String(c));
                  }}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">목표 포인트</label>
                <input type="number" min={1} max={5} className={inputCls}
                  value={tPtStr}
                  onChange={(e)=>{
                    const v = e.target.value;
                    if (v === "") { setTPtStr(""); return; }
                    const n = parseInt(v, 10);
                    if (Number.isNaN(n)) { return; }
                    if (n >= 1 && n <= 5) { setTPtStr(v); setTPt(n); }
                    else { setTPtStr(v); }
                  }}
                  onBlur={()=>{
                    const n = parseInt(tPtStr || "1", 10);
                    const c = clamp15(n);
                    setTPt(c);
                    setTPtStr(String(c));
                  }}
                />
              </div>
            </div>

            <div className="mt-3 p-3 border rounded-xl">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={includeOptions} onChange={(e)=>setIncludeOptions(e.target.checked)} />
                <span className="text-sm font-semibold">목표 옵션(프리셋) 포함하기</span>
              </label>

              {includeOptions && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 p-3 border rounded-xl">
                      <input className="accent-indigo-600" type="radio" name="goalPreset" value="공격형 A&B 5" checked={goalPreset==="공격형 A&B 5"} onChange={()=>setGoalPreset("공격형 A&B 5")} />
                      <span className="text-sm">공격형 A = 5 &nbsp;/&nbsp; 공격형 B = 5</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 border rounded-xl">
                      <input className="accent-indigo-600" type="radio" name="goalPreset" value="서포트형 A&B 5" checked={goalPreset==="서포트형 A&B 5"} onChange={()=>setGoalPreset("서포트형 A&B 5")} />
                      <span className="text-sm">서포트형 A = 5 &nbsp;/&nbsp; 서포트형 B = 5</span>
                    </label>
                  </div>

                  {presetMismatch && (
                    <div className="text-xs text-rose-600">
                      ※ 선택한 프리셋의 타입이 현재 젬 슬롯 타입과 일치하지 않아 달성이 불가능할 수 있습니다.
                    </div>
                  )}

                  {result && (
                    <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 flex items-center justify-between">
                      <div className="text-sm">평균 가공 기대확률</div>
                      <div className="text-xl font-bold">{fmtPct(result.pFromScratch)}</div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 text-xs text-gray-600 bg-gray-50 rounded-lg p-3">
                <div className="font-semibold mb-1">현재 이름-슬롯 매핑</div>
                <div>
                  '옵션1' → <b>{sw ? "슬롯2" : "슬롯1"}</b> (값: <b>{namedO1}</b>, 타입: <b>{sw ? slot2Type : slot1Type}</b>) &nbsp; / &nbsp;
                  '옵션2' → <b>{sw ? "슬롯1" : "슬롯2"}</b> (값: <b>{namedO2}</b>, 타입: <b>{sw ? slot1Type : slot2Type}</b>) &nbsp; | &nbsp; 비용보정: <b>{costAdj}%</b>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 현재 보이는 4가지 효과 (수동 설정) */}
        <div className="bg-white rounded-2xl shadow p-5 mt-6">
          <h2 className="text-lg font-semibold mb-3">3) 현재 화면의 4가지 가공 효과</h2>
          <div className="grid md:grid-cols-4 gap-3">
            {[idx0, idx1, idx2, idx3].map((val, idx) => (
              <div key={idx}>
                <label className="text-sm text-gray-600">옵션 {idx + 1}</label>
                <select className={selectCls}
                  value={[idx0, idx1, idx2, idx3][idx]}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (idx === 0) setIdx0(v);
                    if (idx === 1) setIdx1(v);
                    if (idx === 2) setIdx2(v);
                    if (idx === 3) setIdx3(v);
                  }}
                >
                  {effectOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* 실행 */}
        <div className="flex items-center gap-3 mt-6">
          <button onClick={compute} className="px-5 py-3 rounded-2xl bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-700">확률 계산하기</button>
          <span className="text-gray-500 text-sm">(가속: 가중치 기대값 근사 적용)</span>
        </div>

        {/* 결과 */}
        {result && (
          <div className="grid md:grid-cols-3 gap-6 mt-6">
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="text-sm text-gray-500">지금 가공 버튼을 누르면</div>
              <div className={`text-3xl font-bold mt-1 ${rollVsAllClass}`}>{fmtPct(result.pRollNow)}</div>
              <div className="text-xs text-gray-500 mt-1">(현재 보이는 4가지 중 1개가 무작위로 적용 → 이후 최적 진행)</div>
            </div>
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="text-sm text-gray-500">지금 가공 효과 변경(리롤)하면</div>
              <div className="text-3xl font-bold mt-1">{hasRolled ? fmtPct(result.pChangeNow) : "사용 불가"}</div>
              <div className="text-xs text-gray-500 mt-1">{hasRolled ? "(토큰 1개 사용 후 새 후보 4개 → 이후 최적 진행)" : "첫 가공 전에는 리롤을 사용할 수 없습니다."}</div>
            </div>
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="text-sm text-gray-500">현재 상태에서의 전체 성공확률</div>
              <div className="text-3xl font-bold mt-1">{fmtPct(result.pFromScratch)}</div>
              <div className="text-xs text-gray-500 mt-1">(보이지 않는 상태에서 4개 생성되는 순간부터 최적 진행)</div>
            </div>
          </div>
        )}

     {result && (
  <div className="mt-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-200">
    <div className="text-lg font-semibold">추천</div>
        {result && (
          result.pRollNow < result.pFromScratch ? (
            <div className="mt-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
              ⚠ 현재 가공 성공 확률이 평균 기대값보다 낮습니다.<br/>
              <b>가공을 중단하실 것을 추천합니다.</b>
            </div>
          ) : (
            <div className="mt-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
              {result.recommend === "roll" ? "✔ 지금은 가공 버튼을 누르는 편이 더 유리합니다." : "✔ 지금은 리롤 버튼을 누르는 편이 더 유리합니다."}
            </div>
          )
        )}</div>
    </div>
  );
}
