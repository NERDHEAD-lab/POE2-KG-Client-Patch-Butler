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
- `npm run package:force`: **(필수 검증)** 실행 중인 툴 프로세스를 강제 종료하고 패키징 수행 (파일 잠금 방지). **PR 및 배포 전 반드시 이 명령어로 검증해야 함.**
- `npm run package`: 일반 빌드 및 패키징 (프로세스가 꺼져있을 때 사용)
- `npm run build`: TypeScript 컴파일 (Type Check 용도)
- `npm run bundle`: Tsup을 이용한 번들링 (개별 실행 불필요)

> [!IMPORTANT] > **검증 및 배포 시 `npm run package:force` 필수 사용**
> 단순 `npm run build`는 타입 체크만 수행합니다. 실제 런타임 안정성과 파일 잠금 문제 해결을 위해 반드시 `package:force`로 검증하십시오.

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

### Key Mappings (Reserved)

키 입력 충돌 방지를 위해 현재 사용 중인 단축키를 명시합니다. 새로운 기능을 추가할 때 본 목록에 없는 키를 사용해야 합니다.

| Key        | Context   | Description                |
| :--------- | :-------- | :------------------------- |
| **A**      | Sidebar   | 오류 자동 감지 Toggle      |
| **S**      | Sidebar   | 자동 진행 모드 Toggle      |
| **G**      | Sidebar   | 게임 자동 시작 Toggle      |
| **B**      | Sidebar   | 패치 백업 모드 Toggle      |
| **U**      | Sidebar   | 업데이트 확인 (Hidden)     |
| **R**      | Sidebar   | 백업 복구 (Hidden)         |
| **P**      | Sidebar   | 패치노트 확인              |
| **W**      | Sidebar   | 작동원리                   |
| **I**      | Sidebar   | 피드백 (Issue)             |
| **H**      | Sidebar   | 자주 묻는 질문 (FAQ)       |
| **/**      | Sidebar   | 후원하기                   |
| **Enter**  | Init/Menu | 선택 및 확인               |
| **E**      | Init      | 경로 수정                  |
| **Q**      | Global    | 프로그램 종료              |
| **F**      | Init      | **무시하고 진행 (Ignore)** |
| **1~3, 0** | MainMenu  | 메뉴 선택                  |

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

### ADR-002: Automated Build & Process Cleanup

- **Context**: 빌드 시 실행 중인 툴 프로세스로 인한 파일 잠금(File Lock) 오류가 빈번하게 발생하여 빌드 안정성이 떨어짐.
- **Decision**:
  1. `npm run package:force` 명령어를 신설하여 표준 빌드 방식으로 채택.
  2. 해당 명령어는 `taskkill`을 통해 기존 프로세스를 선제적으로 정리한 후 패키징을 수행하도록 자동화함.
- **Status**: Accepted
- **Date**: 2026-01-05

### ADR-003: Centralized Key Mapping Registry

- **Context**: 기능이 추가됨에 따라 단축키(Shortcut) 충돌 위험이 증가하고 있음(예: `I` 키가 Feedback과 Ignore에 중복 할당될 뻔함). 소스 코드를 일일이 확인하지 않고도 사용 가능한 키를 식별할 수 있는 메커니즘이 필요함.
- **Decision**:
  1. `ARCHITECTURE.md` 내에 **Key Mappings** 섹션을 신설하여 프로젝트의 'Single Source of Truth'로 관리함.
  2. 새로운 UI 기능을 개발할 때는 반드시 이 레지스트리를 먼저 확인하고, 신규 키 할당 시 문서를 동기화하여 업데이트해야 함.
- **Status**: Accepted
- **Date**: 2026-01-05

### ADR-004: UI Component State Lifting Strategy

- **Context**: `Sidebar` 컴포넌트는 UI 일관성 유지를 위해 주요 상태 변경 시 **Remount(재생성)** 되도록 설계됨. 이로 인해 `onInit` 내부에 포함된 API 호출(업데이트 확인 등)이 불필요하게 반복 실행되는 문제가 발생함.
- **Decision**:
  1. `Sidebar`와 같은 Presentational Component는 **Side Effect(API 호출 등)를 직접 수행하지 않도록 함**.
  2. 데이터 Fetching 및 Business Logic은 상위 컴포넌트(`App.tsx`)나 별도의 `State Store`로 **Lift Up(상태 끌어올리기)** 하여 수행하고, `Sidebar`는 결과값만 Props로 받아 렌더링하도록 강제함.
  3. 이를 명확히 하기 위해 `Sidebar.tsx`의 `onInit` 정의에 경고 주석을 추가함.
- **Status**: Accepted
- **Date**: 2026-01-05

### ADR-005: Mandatory Verification with package:force

- **Context**: 단순 빌드(`npm run build`)는 타입 체크만 수행하므로 실제 런타임 안정성과 파일 잠금(File Lock) 이슈를 검증하기에 불충분함. 특히 개발자가 코드 수정 후 프로세스가 남아있는 상태에서 재빌드 시 잦은 오류가 발생함.
- **Decision**:
  1. **모든 코드 수정 후 검증(Verification) 단계**에서는 반드시 `npm run package:force` 명령어를 사용해야 함.
  2. 에이전트(AI) 또한 구현 완료 후 검증 시 이 명령어를 사용하여, 실제 바이너리 생성 및 프로세스 클린업 여부를 확인해야 함.
  3. PR 제출 및 배포 전 최종 검증 수단으로 이 명령어를 강제함.
- **Status**: Accepted
- **Date**: 2026-01-05
