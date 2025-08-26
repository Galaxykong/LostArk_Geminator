# Gem 가공 확률 계산기 (Vite + React + TS + Tailwind)

이 저장소는 바로 배포 가능한 웹앱 템플릿입니다. `src/App.tsx`는 사용자가 제공한 계산기 UI/로직을 포함합니다.
상단의 "후원하기" 버튼 링크와 (선택) AdSense 코드는 여러분 계정으로 바꿔 주세요.

## 빠른 시작 (로컬, 선택)
- Node.js 18+ 설치
- 터미널에서:
  ```bash
  npm i
  npm run dev
  ```

## 배포 (Vercel 권장)
1. 이 폴더를 ZIP으로 GitHub에 새 저장소로 업로드합니다.
2. vercel.com 에 가입 → "Add New..." → "Project" → GitHub에서 방금 만든 저장소 선택 → 프레임워크 자동 감지(Vite) 후 "Deploy".
3. 몇 분 뒤 `https://<프로젝트명>.vercel.app` 주소가 발급됩니다.

## 후원 버튼 바꾸기
- `src/main.tsx`의 `<a href="#">`를 여러분의 후원 링크(예: Toss, Buy Me a Coffee 등)로 교체하세요.

## AdSense 붙이기 (선택)
- AdSense 승인 후, `index.html` 상단의 스크립트와 하단의 `<ins class="adsbygoogle">` 블록의 `YOUR-...` 값을 AdSense에서 발급 받은 값으로 교체하고 주석을 해제합니다.

## 라이선스
- 본 템플릿 자체에는 별도 라이선스를 포함하지 않습니다. 사용하는 데이터/브랜드/서비스 정책을 준수하세요.
