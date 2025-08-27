import React, { useMemo, useState } from "react";

/* -------------------------------------------------
   Gem 가공 확률 계산기 — App.tsx (유물/고대 합산 확률 기능 추가)
   - 2) 현재 능력치에 '현재 첫 번째/두 번째 효과 수치' 입력칸(1~5) 추가
   - '확률 계산하기' 시 합산 점수(we+pt+name1+name2) ≥16/≥19 확률 계산
   - 현재 보이는 4개(pRollNow) vs 전체 평균(pFromScratch) 비교해
     합산 점수 기준 추천(초록/빨강) 배지 표시
--------------------------------------------------*/

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

interface Effect {
  id: string;
  label: string;
  kind: EffectKind;
  plusTier?: 1 | 2 | 3 | 4;
  amount?: 1 | 2;
  delta?: -1;
  baseProb: number; // %
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
  // 첫번째 효과(이름 기준)
  { id: "O1+1", label: "첫번째 효과 Lv. +1", kind: "O1_PLUS", plusTier: 1, baseProb: 11.65 },
  { id: "O1+2", label: "첫번째 효과 Lv. +2", kind: "O1_PLUS", plusTier: 2, baseProb: 4.4 },
  { id: "O1+3", label: "첫번째 효과 Lv. +3", kind: "O1_PLUS", plusTier: 3, baseProb: 1.75 },
  { id: "O1+4", label: "첫번째 효과 Lv. +4", kind: "O1_PLUS", plusTier: 4, baseProb: 0.45 },
  { id: "O1-1", label: "첫번째 효과 Lv. -1", kind: "O1_MINUS1", delta: -1, baseProb: 3.0 },
  // 두번째 효과(이름 기준)
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
interface State {
  we: number; pt: number; o1: number; o2: number; sw: boolean; costAdj: number;
  t1Type: OptionType; t2Type: OptionType;
}
interface Targets {
  we: number; pt: number; includeOptions: boolean;
  target1Type?: OptionType; target1Val?: number;
  target2Type?: OptionType; target2Val?: number;
}

// 이름 기준 현재 값
function currentNameValues(s: State) {
  return { v1: s.sw ? s.o2 : s.o1, v2: s.sw ? s.o1 : s.o2 };
}

// 타입 기준 값(목표판정용)
function valueByTypeDyn(s: State, t: OptionType): number | null {
  if (t === s.t1Type) return s.o1;
  if (t === s.t2Type) return s.o2;
  return null;
}
function isSuccessByTargets(s: State, tg: Targets): boolean {
  if (s.we < tg.we || s.pt < tg.pt) return false;
  if (!tg.includeOptions) return true;
  const ok = (ty?: OptionType, val?: number) => {
    if (!ty || !val) return true;
    const v = valueByTypeDyn(s, ty);
    return v !== null && v >= val;
  };
  return ok(tg.target1Type, tg.target1Val) && ok(tg.target2Type, tg.target2Val);
}

// 합산 점수(이름 기준) ≥ T ?
function isSumAtLeast(s: State, T: number): boolean {
  const { v1, v2 } = currentNameValues(s);
  return (s.we + s.pt + v1 + v2) >= T;
}

// 미등장 조건 반영 가중치
function weightIfEligible(eff: Effect, s: State, attemptsLeft: number): number {
  const { v1, v2 } = currentNameValues(s);
  switch (eff.kind) {
    case "WE_PLUS": {
      const t = eff.plusTier!;
      if (t === 1 && s.we === 5) return 0;
      if (t === 2 && s.we >= 4) return 0;
      if (t === 3 && s.we >= 3) return 0;
      if (t === 4 && s.we >= 2) return 0;
      return eff.baseProb;
    }
    case "WE_MINUS1": return s.we === 1 ? 0 : eff.baseProb;
    case "PT_PLUS": {
      const t = eff.plusTier!;
      if (t === 1 && s.pt === 5) return 0;
      if (t === 2 && s.pt >= 4) return 0;
      if (t === 3 && s.pt >= 3) return 0;
      if (t === 4 && s.pt >= 2) return 0;
      return eff.baseProb;
    }
    case "PT_MINUS1": return s.pt === 1 ? 0 : eff.baseProb;
    case "O1_PLUS": {
      const t = eff.plusTier!;
      if (t === 1 && v1 === 5) return 0;
      if (t === 2 && v1 >= 4) return 0;
      if (t === 3 && v1 >= 3) return 0;
      if (t === 4 && v1 >= 2) return 0;
      return eff.baseProb;
    }
    case "O1_MINUS1": return v1 === 1 ? 0 : eff.baseProb;
    case "O2_PLUS": {
      const t = eff.plusTier!;
      if (t === 1 && v2 === 5) return 0;
      if (t === 2 && v2 >= 4) return 0;
      if (t === 3 && v2 >= 3) return 0;
      if (t === 4 && v2 >= 2) return 0;
      return eff.baseProb;
    }
    case "O2_MINUS1": return v2 === 1 ? 0 : eff.baseProb;
    case "COST_UP": return (s.costAdj >= 100 || attemptsLeft === 1) ? 0 : eff.baseProb;
    case "COST_DOWN": return (s.costAdj <= -100 || attemptsLeft === 1) ? 0 : eff.baseProb;
    case "REROLL_PLUS": return attemptsLeft === 1 ? 0 : eff.baseProb;
    case "O1_CHANGE":
    case "O2_CHANGE":
    case "HOLD": return eff.baseProb;
  }
}

// 비복원 가중치 샘플링(4개) — UI용
function sample4WeightedIndices(state: State, attemptsLeft: number): number[] {
  const weights = E.map((eff) => weightIfEligible(eff, state, attemptsLeft));
  const picks: number[] = [];
  const w = [...weights];
  for (let k = 0; k < 4; k++) {
    const total = sum(w);
    if (total <= 0) break;
    let r = Math.random() * total, chosen = -1;
    for (let i = 0; i < w.length; i++) {
      if (w[i] <= 0) continue;
      if (r < w[i]) { chosen = i; break; }
      r -= w[i];
    }
    if (chosen === -1) break;
    picks.push(chosen);
    w[chosen] = 0;
  }
  if (picks.length < 4) {
    const rest = weights.map((ww, i) => ({ ww, i }))
      .filter(x => x.ww > 0 && !picks.includes(x.i))
      .map(x => x.i).slice(0, 4 - picks.length);
    picks.push(...rest);
  }
  return picks.sort((a, b) => a - b);
}

// 가중치 기대값(가속 근사)
function weightedMeanF(s: State, attemptsLeft: number, fAll: number[]): number {
  const ws = E.map((eff) => weightIfEligible(eff, s, attemptsLeft));
  const total = sum(ws);
  if (total <= 0) return 0;
  let acc = 0;
  for (let i = 0; i < ws.length; i++) acc += ws[i] * fAll[i];
  return acc / total;
}


// 효과 적용
function applyEffect(s: State, eff: Effect, changeTo?: OptionType): { next: State; addToken: number } {
  let { we, pt, o1, o2, sw, costAdj, t1Type, t2Type } = s;
  let addToken = 0;
  const addToName1 = (d: number) => { if (!sw) o1 = clamp15(o1 + d); else o2 = clamp15(o2 + d); };
  const addToName2 = (d: number) => { if (!sw) o2 = clamp15(o2 + d); else o1 = clamp15(o1 + d); };

  switch (eff.kind) {
    case "WE_PLUS": we = clamp15(we + (eff.plusTier || 1)); break;
    case "WE_MINUS1": we = clamp15(we - 1); break;
    case "PT_PLUS": pt = clamp15(pt + (eff.plusTier || 1)); break;
    case "PT_MINUS1": pt = clamp15(pt - 1); break;
    case "O1_PLUS": addToName1(eff.plusTier || 1); break;
    case "O1_MINUS1": addToName1(-1); break;
    case "O2_PLUS": addToName2(eff.plusTier || 1); break;
    case "O2_MINUS1": addToName2(-1); break;
    case "O1_CHANGE": {
      const pool = OPTION_TYPES.filter((t) => t !== s.t1Type);
      t1Type = changeTo ?? pool[Math.floor(Math.random() * pool.length)];
      break;
    }
    case "O2_CHANGE": {
      const pool = OPTION_TYPES.filter((t) => t !== s.t2Type);
      t2Type = changeTo ?? pool[Math.floor(Math.random() * pool.length)];
      break;
    }
    case "COST_UP": costAdj = clampCost(costAdj + 100); break;
    case "COST_DOWN": costAdj = clampCost(costAdj - 100); break;
    case "HOLD": break;
    case "REROLL_PLUS": addToken = (eff.amount || 1); break;
  }
  return { next: { we, pt, o1, o2, sw, costAdj, t1Type, t2Type }, addToken };
}

// 공통 DP 엔진(성공 판정 함수를 주입)
function buildEngineWithPredicate(successPred: (s: State) => boolean) {
  const memo = new Map<string, number>();

  function P_pre(s: State, N: number, C: number, lockReroll: boolean): number {
    if (successPred(s)) return 1;
    if (N <= 0) return 0;
    const key = `K:${s.we},${s.pt},${s.o1},${s.o2},${s.sw?'1':'0'},${s.costAdj},${s.t1Type},${s.t2Type}|N:${N}|C:${C}|L:${lockReroll?'1':'0'}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

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

    if (C <= 0 || lockReroll) {
      const val = weightedMeanF(s, N, fAll);
      memo.set(key, val);
      return val;
    }
    const valueIfChange = P_pre(s, N, C - 1, false);
    const rollMean = weightedMeanF(s, N, fAll);
    const val = Math.max(rollMean, valueIfChange);
    memo.set(key, val);
    return val;
  }

  function P_roll_now(s: State, N: number, C: number, currentIdx4: number[]): number {
    if (successPred(s)) return 1;
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
    return avg(currentIdx4.map((i) => fAll[i]));
  }

  return { P_pre, P_roll_now };
}

// 기존 ‘목표 달성’ 엔진
function buildProbabilityEngine(targets: Targets) {
  return buildEngineWithPredicate((s) => isSuccessByTargets(s, targets));
}

// 라벨
function labelForEffect(e: Effect, slot1Type: OptionType, slot2Type: OptionType): string {
  switch (e.kind) {
    case "O1_PLUS": return `${slot1Type} Lv. +${e.plusTier ?? 1}`;
    case "O1_MINUS1": return `${slot1Type} Lv. -1`;
    case "O2_PLUS": return `${slot2Type} Lv. +${e.plusTier ?? 1}`;
    case "O2_MINUS1": return `${slot2Type} Lv. -1`;
    default: return e.label;
  }
}
const fmtPct = (x: number) => `${(x * 100).toFixed(2)}%`;

// ================ 컴포넌트 ================
export default function App() {
  const inputCls =
    "w-full mt-1 rounded-xl bg-white ring-1 ring-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";
  const selectCls = inputCls + " appearance-none";

  const [rarity, setRarity] = useState<"고급" | "희귀" | "영웅">("고급");
  const defaultAttempts = rarity === "고급" ? 5 : rarity === "희귀" ? 7 : 9;
  const defaultTokens = rarity === "고급" ? 0 : rarity === "희귀" ? 1 : 2;
  const [attempts, setAttempts] = useState<number>(defaultAttempts);
  const [tokens, setTokens] = useState<number>(defaultTokens);

  const [we, setWe] = useState<number>(1);
  const [pt, setPt] = useState<number>(1);
  const [weStr, setWeStr] = useState<string>(String(we));
  const [ptStr, setPtStr] = useState<string>(String(pt));
  React.useEffect(() => { setWeStr(String(we)); }, [we]);
  React.useEffect(() => { setPtStr(String(pt)); }, [pt]);

  // [NEW] 현재 첫/두 번째 효과 수치 입력 (o1/o2)
  const [o1, setO1] = useState<number>(1);
  const [o2, setO2] = useState<number>(1);
  const [o1Str, setO1Str] = useState<string>(String(o1));
  const [o2Str, setO2Str] = useState<string>(String(o2));
  React.useEffect(() => { setO1Str(String(o1)); }, [o1]);
  React.useEffect(() => { setO2Str(String(o2)); }, [o2]);

  const [sw, setSw] = useState<boolean>(false);
  const [costAdj, setCostAdj] = useState<number>(0);

  const [slot1Type, setSlot1Type] = useState<OptionType>("공격형 A");
  const [slot2Type, setSlot2Type] = useState<OptionType>("공격형 B");

  const [tWe, setTWe] = useState<number>(5);
  const [tPt, setTPt] = useState<number>(5);
  const [tWeStr, setTWeStr] = useState<string>("5");
  const [tPtStr, setTPtStr] = useState<string>("5");
  React.useEffect(() => { setTWeStr(String(tWe)); }, [tWe]);
  React.useEffect(() => { setTPtStr(String(tPt)); }, [tPt]);

  const [includeOptions, setIncludeOptions] = useState<boolean>(false);
  const [goalPreset, setGoalPreset] = useState<GoalPreset>("없음");

  // 현재 화면 4개
  const [idx0, setIdx0] = useState<number>(0);
  const [idx1, setIdx1] = useState<number>(1);
  const [idx2, setIdx2] = useState<number>(2);
  const [idx3, setIdx3] = useState<number>(3);

// ✅ 사용자가 지정한 순서를 그대로 유지
  const currentIdx4 = useMemo(() => [idx0, idx1, idx2, idx3], [idx0, idx1, idx2, idx3]);


  const [hasRolled, setHasRolled] = useState<boolean>(false);
  React.useEffect(() => {
    const v = rarity === "고급" ? 5 : rarity === "희귀" ? 7 : 9;
    const tks = rarity === "고급" ? 0 : rarity === "희귀" ? 1 : 2;
    setAttempts(v);
    setTokens(tks);
    setHasRolled(false);
  }, [rarity]);

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

  // 엔진: 목표 달성 / 합산 점수(16/19)
  const engine = useMemo(() => buildProbabilityEngine(targets), [targets]);
  const sum16Engine = useMemo(() => buildEngineWithPredicate((s) => isSumAtLeast(s, 16)), []);
  const sum19Engine = useMemo(() => buildEngineWithPredicate((s) => isSumAtLeast(s, 19)), []);

  // 결과
  const [computed, setComputed] = useState<boolean>(false);
  const [result, setResult] = useState<null | {
    pRollNow: number; pChangeNow: number; pFromScratch: number; recommend: "roll" | "change";
    p16_rollNow: number; p16_fromScratch: number;
    p19_rollNow: number; p19_fromScratch: number;
  }>(null);

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

const resetAll = React.useCallback(() => {
  // 기본 설정
  setRarity("고급");
  setCostAdj(0);

  // ✅ 등급과 무관하게 직접 초기화(가공 가능 횟수/리롤 토큰)
  setAttempts(5);
  setTokens(0);

  // 현재 능력치 & 목표
  setWe(1); setWeStr("1");
  setPt(1); setPtStr("1");
  setO1(1); setO1Str("1");
  setO2(1); setO2Str("1");
  setSw(false);

  setSlot1Type("공격형 A");
  setSlot2Type("공격형 B");

  setTWe(5); setTWeStr("5");
  setTPt(5); setTPtStr("5");

  setIncludeOptions(false);
  setGoalPreset("없음");

  // 화면/결과
  setIdx0(0); setIdx1(1); setIdx2(2); setIdx3(3);
  setHasRolled(false);
  setComputed(false);
  setResult(null);

  // 필요 시 후보 4개 재생성
  regenCurrent4Weighted();
}, []);



  function compute() {
    const s: State = { we, pt, o1, o2, sw, costAdj, t1Type: slot1Type, t2Type: slot2Type };
    const lock = !hasRolled;

    // 목표 달성 관점
    const pRollNow = engine.P_roll_now(s, attempts, tokens, currentIdx4);
    const pChangeNow = tokens > 0 && !lock ? engine.P_pre(s, attempts, tokens - 1, false) : 0;
    const pFromScratch = engine.P_pre(s, attempts, tokens, lock);

    // [NEW] 합산 점수 관점(유물/고대)
    const p16_rollNow = sum16Engine.P_roll_now(s, attempts, tokens, currentIdx4);
    const p16_fromScratch = sum16Engine.P_pre(s, attempts, tokens, lock);
    const p19_rollNow = sum19Engine.P_roll_now(s, attempts, tokens, currentIdx4);
    const p19_fromScratch = sum19Engine.P_pre(s, attempts, tokens, lock);

    const recommend = (!lock && tokens > 0 && pChangeNow > pRollNow) ? "change" : "roll";
    setResult({ pRollNow, pChangeNow, pFromScratch, recommend, p16_rollNow, p16_fromScratch, p19_rollNow, p19_fromScratch });
    setComputed(true);
  }

  // 실제 적용
  function applyEffectByIndex(idx: number) {
    if (attempts <= 0) return;
    const s: State = { we, pt, o1, o2, sw, costAdj, t1Type: slot1Type, t2Type: slot2Type };
    const { next, addToken } = applyEffect(s, E[idx]);
    setWe(next.we); setPt(next.pt); setO1(next.o1); setO2(next.o2);
    setSw(next.sw); setCostAdj(next.costAdj); setSlot1Type(next.t1Type); setSlot2Type(next.t2Type);
    setAttempts((n) => Math.max(0, n - 1));
    if (addToken > 0) setTokens((t) => t + addToken);
    if (!hasRolled) setHasRolled(true);
    regenCurrent4Weighted();

    // 즉시 재계산
    const lock = false;
    const s2: State = { ...next };
    const pRollNow = engine.P_roll_now(s2, Math.max(0, attempts - 1), tokens + (addToken || 0), currentIdx4);
    const pChangeNow = (tokens + (addToken || 0)) > 0 ? engine.P_pre(s2, Math.max(0, attempts - 1), (tokens + (addToken || 0)) - 1, false) : 0;
    const pFromScratch = engine.P_pre(s2, Math.max(0, attempts - 1), tokens + (addToken || 0), false);

    const p16_rollNow = sum16Engine.P_roll_now(s2, Math.max(0, attempts - 1), tokens + (addToken || 0), currentIdx4);
    const p16_fromScratch = sum16Engine.P_pre(s2, Math.max(0, attempts - 1), tokens + (addToken || 0), false);
    const p19_rollNow = sum19Engine.P_roll_now(s2, Math.max(0, attempts - 1), tokens + (addToken || 0), currentIdx4);
    const p19_fromScratch = sum19Engine.P_pre(s2, Math.max(0, attempts - 1), tokens + (addToken || 0), false);

    const recommend = ((tokens + (addToken || 0)) > 0 && pChangeNow > pRollNow) ? "change" : "roll";
    setResult({ pRollNow, pChangeNow, pFromScratch, recommend, p16_rollNow, p16_fromScratch, p19_rollNow, p19_fromScratch });
  }

  function rerollSet() {
    if (tokens <= 0) return;
    if (!hasRolled) return;
    setTokens((t) => t - 1);
    regenCurrent4Weighted();

    const s: State = { we, pt, o1, o2, sw, costAdj, t1Type: slot1Type, t2Type: slot2Type };
    const pRollNow = engine.P_roll_now(s, attempts, Math.max(0, tokens - 1), currentIdx4);
    const pChangeNow = Math.max(0, tokens - 1) > 0 ? engine.P_pre(s, attempts, Math.max(0, tokens - 1) - 1, false) : 0;
    const pFromScratch = engine.P_pre(s, attempts, Math.max(0, tokens - 1), false);

    const p16_rollNow = sum16Engine.P_roll_now(s, attempts, Math.max(0, tokens - 1), currentIdx4);
    const p16_fromScratch = sum16Engine.P_pre(s, attempts, Math.max(0, tokens - 1), false);
    const p19_rollNow = sum19Engine.P_roll_now(s, attempts, Math.max(0, tokens - 1), currentIdx4);
    const p19_fromScratch = sum19Engine.P_pre(s, attempts, Math.max(0, tokens - 1), false);

    const recommend = (Math.max(0, tokens - 1) > 0 && pChangeNow > pRollNow) ? "change" : "roll";
    setResult({ pRollNow, pChangeNow, pFromScratch, recommend, p16_rollNow, p16_fromScratch, p19_rollNow, p19_fromScratch });
  }

  const namedO1 = sw ? o2 : o1;
  const namedO2 = sw ? o1 : o2;

  const presetMismatch = useMemo(() => {
    if (!includeOptions) return false;
    if (goalPreset === "공격형 A&B 5")
      return !([slot1Type, slot2Type].includes("공격형 A") && [slot1Type, slot2Type].includes("공격형 B"));
    if (goalPreset === "서포트형 A&B 5")
      return !([slot1Type, slot2Type].includes("서포트형 A") && [slot1Type, slot2Type].includes("서포트형 B"));
    return false;
  }, [includeOptions, goalPreset, slot1Type, slot2Type]);

  const effectOptions = useMemo(() => (
    E.map((e, i) => ({ value: i, label: labelForEffect(e, slot1Type, slot2Type) }))
  ), [slot1Type, slot2Type]);

  React.useEffect(() => { if (computed) compute(); }, [tWe, tPt, includeOptions, goalPreset, slot1Type, slot2Type]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6 font-sans antialiased">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-1">
          LostArk Geminator
          <span className="ml-2 text-base md:text-lg text-gray-400 font-normal">Made by 갤럭시카드 @아브렐슈드</span>
        </h1>
        <p className="text-sm md:text-base text-gray-600 mb-6">
          실제 <b>등장 확률</b>과 <b>미등장 조건</b>을 반영하여 4개 후보를 생성하고, 선택/리롤 전략까지 고려한 목표 달성 확률을 계산합니다.
        </p>

        {/* 입력 카드들 */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* 좌측: 기본 설정 */}
          <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            <h2 className="text-lg font-semibold">1) 기본 설정</h2>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-sm text-gray-600">젬 등급</label>
                <select className={selectCls} value={rarity} onChange={(e)=>setRarity(e.target.value as any)}>
                  <option>고급</option><option>희귀</option><option>영웅</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">가공 가능 횟수</label>
                <input type="number" className={inputCls} value={attempts} min={0}
                  onChange={(e)=>setAttempts(parseInt(e.target.value||"0",10))}/>
              </div>
              <div>
                <label className="text-sm text-gray-600">가공 효과 변경(리롤) 토큰</label>
                <input type="number" className={inputCls} value={tokens} min={0}
                  onChange={(e)=>setTokens(parseInt(e.target.value||"0",10))}/>
              </div>
              <div>
                <label className="text-sm text-gray-600">비용 보정 (−100 ~ +100)</label>
                <input type="number" className={inputCls} value={costAdj} min={-100} max={100}
                  onChange={(e)=>setCostAdj(clampCost(parseInt(e.target.value||"0",10)))}/>
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
            </div>
          </div>

          {/* 우측: 현재 능력치 / 목표 */}
          <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            <h2 className="text-lg font-semibold">2) 현재 능력치 & 목표</h2>
            <div className="grid grid-cols-2 gap-3">
              {/* 현재 의지력 */}
              <div>
                <label className="text-sm text-gray-600">현재 의지력 효율</label>
                <input type="number" min={1} max={5} className={inputCls}
                  value={weStr}
                  onChange={(e)=>{ const v=e.target.value; if(v===""){setWeStr("");return;}
                    const n=parseInt(v,10); if(Number.isNaN(n))return; if(n>=1&&n<=5){setWeStr(v);setWe(n);} else setWeStr(v);}}
                  onBlur={()=>{ const n=parseInt(weStr||"1",10); const c=clamp15(n); setWe(c); setWeStr(String(c));}}/>
              </div>
              {/* 목표 의지력 */}
              <div>
                <label className="text-sm text-gray-600">목표 의지력 효율</label>
                <input type="number" min={1} max={5} className={inputCls}
                  value={tWeStr}
                  onChange={(e)=>{ const v=e.target.value; if(v===""){setTWeStr("");return;}
                    const n=parseInt(v,10); if(Number.isNaN(n))return; if(n>=1&&n<=5){setTWeStr(v);setTWe(n);} else setTWeStr(v);}}
                  onBlur={()=>{ const n=parseInt(tWeStr||"1",10); const c=clamp15(n); setTWe(c); setTWeStr(String(c));}}/>
              </div>

              {/* 현재 포인트 */}
              <div>
                <label className="text-sm text-gray-600">현재 포인트</label>
                <input type="number" min={1} max={5} className={inputCls}
                  value={ptStr}
                  onChange={(e)=>{ const v=e.target.value; if(v===""){setPtStr("");return;}
                    const n=parseInt(v,10); if(Number.isNaN(n))return; if(n>=1&&n<=5){setPtStr(v);setPt(n);} else setPtStr(v);}}
                  onBlur={()=>{ const n=parseInt(ptStr||"1",10); const c=clamp15(n); setPt(c); setPtStr(String(c));}}/>
              </div>
              {/* 목표 포인트 */}
              <div>
                <label className="text-sm text-gray-600">목표 포인트</label>
                <input type="number" min={1} max={5} className={inputCls}
                  value={tPtStr}
                  onChange={(e)=>{ const v=e.target.value; if(v===""){setTPtStr("");return;}
                    const n=parseInt(v,10); if(Number.isNaN(n))return; if(n>=1&&n<=5){setTPtStr(v);setTPt(n);} else setTPtStr(v);}}
                  onBlur={()=>{ const n=parseInt(tPtStr||"1",10); const c=clamp15(n); setTPt(c); setTPtStr(String(c));}}/>
              </div>

              {/* [NEW] 현재 첫/두 번째 효과 수치 */}
              <div>
                <label className="text-sm text-gray-600">현재 첫 번째 효과 수치</label>
                <input type="number" min={1} max={5} className={inputCls}
                  value={o1Str}
                  onChange={(e)=>{ const v=e.target.value; if(v===""){setO1Str("");return;}
                    const n=parseInt(v,10); if(Number.isNaN(n))return; if(n>=1&&n<=5){setO1Str(v);setO1(n);} else setO1Str(v);}}
                  onBlur={()=>{ const n=parseInt(o1Str||"1",10); const c=clamp15(n); setO1(c); setO1Str(String(c));}}/>
              </div>
              <div>
                <label className="text-sm text-gray-600">현재 두 번째 효과 수치</label>
                <input type="number" min={1} max={5} className={inputCls}
                  value={o2Str}
                  onChange={(e)=>{ const v=e.target.value; if(v===""){setO2Str("");return;}
                    const n=parseInt(v,10); if(Number.isNaN(n))return; if(n>=1&&n<=5){setO2Str(v);setO2(n);} else setO2Str(v);}}
                  onBlur={()=>{ const n=parseInt(o2Str||"1",10); const c=clamp15(n); setO2(c); setO2Str(String(c));}}/>
              </div>
            </div>

            <div className="mt-3 p-3 border rounded-xl">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4 accent-indigo-600"
                  checked={includeOptions} onChange={(e)=>setIncludeOptions(e.target.checked)} />
                <span className="text-sm font-semibold">보조 효과 목표 포함하기</span>
              </label>

              {includeOptions && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 p-3 border rounded-xl">
                      <input className="accent-indigo-600" type="radio" name="goalPreset"
                        value="공격형 A&B 5" checked={goalPreset==="공격형 A&B 5"}
                        onChange={()=>setGoalPreset("공격형 A&B 5")} />
                      <span className="text-sm">공격형 A = 5 / 공격형 B = 5</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 border rounded-xl">
                      <input className="accent-indigo-600" type="radio" name="goalPreset"
                        value="서포트형 A&B 5" checked={goalPreset==="서포트형 A&B 5"}
                        onChange={()=>setGoalPreset("서포트형 A&B 5")} />
                      <span className="text-sm">서포트형 A = 5 / 서포트형 B = 5</span>
                    </label>
                  </div>

                  {presetMismatch && (
                    <div className="text-xs text-rose-600">
                      ※ 선택한 프리셋의 타입이 현재 젬 슬롯 타입과 일치하지 않아 달성이 불가능할 수 있습니다.
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        </div>

        {/* 현재 보이는 4가지 */}
        <div className="bg-white rounded-2xl shadow p-5 mt-6">
          <h2 className="text-lg font-semibold mb-3">3) 현재 화면의 4가지 가공 효과</h2>
          <div className="grid md:grid-cols-4 gap-3">
            {[idx0, idx1, idx2, idx3].map((val, idx) => (
              <div key={idx}>
                <label className="text-sm text-gray-600">옵션 {idx + 1}</label>
                <select className={selectCls}
                  value={[idx0, idx1, idx2, idx3][idx]}
                  onChange={(e)=>{ const v=parseInt(e.target.value,10);
                    if(idx===0) setIdx0(v); if(idx===1) setIdx1(v); if(idx===2) setIdx2(v); if(idx===3) setIdx3(v); }}
                >
                  {effectOptions.map((opt)=>(
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

      {/* 실행 */}
<div className="relative mt-6">
  {/* 가운데 정렬된 메인 버튼 */}
  <div className="flex justify-center">
    <button
      onClick={compute}
      className="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-700"
    >
      확률 계산하기
    </button>
  </div>

  {/* 우측 상단 작고 붉은 리셋 버튼 */}
  <button
    onClick={resetAll}
    className="absolute right-0 top-1/2 -translate-y-1/2 px-3 py-2 text-xs rounded-xl bg-rose-600 text-white shadow hover:bg-rose-700"
    title="기본 설정과 현재 능력치 & 목표를 초기 상태로 되돌립니다."
  >
    리셋
  </button>
</div>


        {/* 결과 카드들 (목표 달성) */}
        {result && (
          <div className="grid md:grid-cols-3 gap-6 mt-6">
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="text-sm text-gray-500">지금 가공 버튼을 누르면</div>
              <div className={`text-3xl font-bold mt-1 ${rollVsAllClass}`}>{fmtPct(result.pRollNow)}</div>
              <div className="text-xs text-gray-500 mt-1">(현재 보이는 4가지 중 1개 무작위 적용 → 이후 최적 진행)</div>
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

        {/* [NEW] 합산 점수(유물/고대) 카드 */}
        {result && (
          <div className="bg-white rounded-2xl shadow p-5 mt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">합산 점수 달성 확률</h3>
              <span className={`text-xs px-2 py-1 rounded-full border ${
                ((result.p16_rollNow + result.p19_rollNow) > (result.p16_fromScratch + result.p19_fromScratch))
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
              }`}>
                {((result.p16_rollNow + result.p19_rollNow) > (result.p16_fromScratch + result.p19_fromScratch))
                  ? "추천"
                  : "비추천"}
              </span>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2">기준</th>
                    <th className="py-2">지금 가공 (현재 4개)</th>
                    <th className="py-2">전체 평균 (새 4개 생성)</th>
                    <th className="py-2">차이</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="py-2 font-medium">유물젬 (≥16)</td>
                    <td className="py-2">{fmtPct(result.p16_rollNow)}</td>
                    <td className="py-2">{fmtPct(result.p16_fromScratch)}</td>
                    <td className={`py-2 ${result.p16_rollNow >= result.p16_fromScratch ? "text-emerald-600" : "text-rose-600"}`}>
                      {( (result.p16_rollNow - result.p16_fromScratch) * 100 ).toFixed(2)}%
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-2 font-medium">고대젬 (≥19)</td>
                    <td className="py-2">{fmtPct(result.p19_rollNow)}</td>
                    <td className="py-2">{fmtPct(result.p19_fromScratch)}</td>
                    <td className={`py-2 ${result.p19_rollNow >= result.p19_fromScratch ? "text-emerald-600" : "text-rose-600"}`}>
                      {( (result.p19_rollNow - result.p19_fromScratch) * 100 ).toFixed(2)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* 추천 멘트(목표 관점) */}
        {result && (
          <div className="mt-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-200">
            <div className="text-lg font-semibold">추천</div>
            {(hasRolled && tokens > 0 && result.pRollNow < result.pFromScratch) ? (
              <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
                ⚠ 현재 가공 성공 확률이 평균 기댓값보다 낮습니다.<br/>
                <b>리롤을 사용하는 것을 추천합니다.</b> (보유 토큰: {tokens}개)
              </div>
            ) : result.pRollNow < result.pFromScratch ? (
              <div className="mt-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
                ⚠ 현재 가공 성공 확률이 평균 기댓값보다 낮습니다.<br/>
                <b>가공을 중단하실 것을 추천합니다.</b>
              </div>
            ) : (
              <div className="mt-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                {result.recommend === "roll"
                  ? "✔ 지금은 가공 버튼을 누르는 편이 더 유리합니다."
                  : "✔ 지금은 리롤 버튼을 누르는 편이 더 유리합니다."}
              </div>
            )}
          </div>
        )}

        {/* 4) 시뮬레이션 진행 */}
        {computed && (
          <div className="bg-white rounded-2xl shadow p-5 mt-6">
            <h2 className="text-lg font-semibold mb-2">4) 시뮬레이션 진행</h2>
            <div className="text-xs text-gray-600 mb-3">
              남은 가공 가능 횟수: <b>{attempts}</b>회 &nbsp;/&nbsp; 리롤 토큰: <b>{tokens}</b>개
            </div>

            <div className="grid md:grid-cols-4 gap-3">
              {currentIdx4.map((i) => (
                <button key={i} onClick={()=>applyEffectByIndex(i)} disabled={attempts <= 0}
                  className="w-full px-3 py-3 rounded-xl border text-left shadow-sm hover:bg-gray-50 disabled:opacity-50"
                  title="이 효과를 적용하여 다음 단계로 진행합니다.">
                  <div className="text-sm font-semibold">{labelForEffect(E[i], slot1Type, slot2Type)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">({E[i].label})</div>
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button onClick={rerollSet} disabled={tokens <= 0 || !hasRolled}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white shadow hover:bg-amber-700 disabled:opacity-50"
                title={hasRolled ? "현재 후보 4개를 새로 뽑습니다. (토큰 1개 소비)" : "첫 가공 전에는 리롤을 사용할 수 없습니다."}>
                🔁 가공 효과 변경(리롤)
              </button>
              <span className="text-xs text-gray-500">
                {hasRolled ? "리롤은 첫 가공 후부터 사용 가능" : "첫 가공 전에는 리롤 불가"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
