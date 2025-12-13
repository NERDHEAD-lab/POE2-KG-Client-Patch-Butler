# POE2 KG Client Patch Butler

Kakao Games의 Path of Exile 2 클라이언트 패치 실패 문제를 해결하기 위한 도구입니다.

## 기능

- **자동 경로 탐지**: 레지스트리 및 저장된 설정을 통해 설치 경로를 자동으로 찾습니다.
- **로그 분석**: `KakaoClient.txt` 로그를 분석하여 다운로드에 실패한 파일을 식별합니다.
- **자동 다운로드**: 누락된 파일을 자동으로 다운로드하고 설치 경로에 복구합니다.
- **진행률 표시**: 각 파일의 다운로드 진행 상황을 실시간으로 표시합니다.

## 사용 방법

1. [Releases](https://github.com/NERDHEAD-lab/POE2-KG-Client-Patch-Butler/releases) 페이지에서 최신 `poe2-patch-butler.exe` 파일을 다운로드합니다.
2. 다운로드한 파일을 실행합니다.
3. 자동으로 설치 경로를 찾습니다. 경로가 맞다면 `Enter`를 눌러 계속 진행합니다. (아니라면 `E`를 눌러 수정 가능)
4. 로그 분석 후 누락된 파일이 있다면 자동으로 다운로드가 시작됩니다.
5. 모든 작업이 완료되면 안내 메시지가 표시됩니다.

## 개발

### 요구 사항

- Node.js 18+
- npm

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run dev

# 빌드
npm run build

# 실행 파일 생성
npm run package
```

## 라이선스

MIT
