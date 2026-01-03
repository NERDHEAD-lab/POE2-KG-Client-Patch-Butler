# Architecture: POE2-KG-Client-Patch-Butler

이 문서는 POE2-KG-Client-Patch-Butler 프로젝트의 기술 스택, 디렉토리 구조 및 코딩 컨벤션을 정의합니다.

## 1. Project Context

- **목적**: Kakao Games Path of Exile 2 클라이언트의 패치 프로세스를 보조하고 자동화하는 CLI 도구.
- **주요 기능**: 패치 파일 다운로드 최적화, 레지스트리 관리, 패치 상태 확인 및 CLI UI 제공.

### Tech Stack

- **Runtime**: Node.js (v22+)
- **Language**: TypeScript
- **UI Framework**: React (with [Ink](https://github.com/vadimdemedes/ink) for CLI)
- **Bundler**: [Tsup](https://tsup.egoist.dev/)
- **Libraries**:
  - `axios`: 리소스 다운로드 및 API 통신
  - `winreg`: Windows 레지스트리 제어
  - `meow`: CLI 인자 파싱

### Build Commands

- `npm run dev`: 개발 모드 실행 (`ts-node`)
- `npm run package`: **(권장)** 빌드, 번들링, 실행 파일(`exe`) 생성을 한 번에 수행
- `npm run build`: TypeScript 컴파일 (Type Check 용도)
- `npm run bundle`: Tsup을 이용한 번들링 (개별 실행 불필요)

> [!IMPORTANT] > **패키징 필수 절차 (Mandatory)** > `npm run package` 명령을 실행하기 전에, 반드시 기존 `poe2-patch-butler.exe` 프로세스를 종료해야 합니다.
>
> 1. **프로세스 종료**: `taskkill /F /IM poe2-patch-butler.exe`
> 2. **빌드 실행**: `npm run package` (이 명령어 하나로 빌드/번들/패키징 완료)

## 2. Directory Structure

```text
/
├── dist/               # 빌드 결과물
├── docs/               # 문서 (ARCHITECTURE.md, FAQ 등)
├── scripts/            # 빌드 및 자산 생성 스크립트
├── src/                # 소스 코드
│   ├── ui/             # React (Ink) 컴포넌트
│   │   ├── Menu/       # 메뉴 관련 컴포넌트
│   │   └── ...
│   ├── utils/          # 유틸리티 함수 (레지스트리, 파일 제어 등)
│   ├── cli.tsx         # 진입점 (CLI 초기화)
│   └── watcher.ts      # 상태 감시 로직
└── tsconfig.json       # TypeScript 설정
```

## 3. Coding Conventions

Node.js 및 TypeScript 표준 컨벤션을 따릅니다.

### Naming Rules

- **Files**: `kebab-case.ts` (일반 파일), `PascalCase.tsx` (React 컴포넌트)
- **Variables & Functions**: `camelCase`
- **Classes & Interfaces**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`

### Patterns

- **CLI UI**: `Ink`를 사용하여 선언적 UI 구조 유지
- **Error Handling**: 비동기 작업에 대해 `try-catch` 블록 필수 사용 및 적절한 사용자 피드백(UI) 제공
- **Registry**: `winreg`를 감싼 유틸리티 클래스를 통해 일관된 레지스트리 접근 제어

## 4. Glossary & Terminology

프로젝트 내에서 사용하는 주요 명칭 및 별칭입니다.

- **공식 명칭**: POE2-KG-Client-Patch-Butler
- **별칭**: 오류수정도구, 툴 (Tool)
- **설명**: 사용자와의 소통 시 편의를 위해 "오류수정도구" 또는 간단히 "툴"이라 지칭할 수 있습니다.

## 5. Architecture Decision Records (ADR)

### ADR-001: Project Aliasing for Communication

- **Context**: 프로젝트의 공식 명칭이 길어 원활한 소통을 위해 짧은 별칭이 필요함.
- **Decision**: "오류수정도구" 및 "툴"을 공식 별칭으로 채택하여 문서 및 대화에서 혼용 가능하도록 함.
- **Status**: Accepted
- **Date**: 2026-01-04

### ADR-002: Simplified Build Process

- **Context**: 사용자 피드백에 따라 빌드 프로세스의 효율성과 안정성을 높일 필요가 있음. 불필요한 개별 커맨드 실행을 줄이고, 파일 잠금(File Lock)으로 인한 빌드 실패를 방지해야 함.
- **Decision**:
  1. `npm run package`를 단일 빌드 명령어로 표준화 (내부적으로 `bundle` 포함).
  2. 빌드 전 `poe2-patch-butler.exe` 프로세스 강제 종료(`taskkill`)를 필수 절차로 규정.
- **Status**: Accepted
- **Date**: 2026-01-04
