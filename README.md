<!-- prettier-ignore-start -->

| GitHub Release                                                 | Build Status                                             | License                                                        | Sponsors                                                          | Buy Me a Coffee                                                   |
|----------------------------------------------------------------|----------------------------------------------------------|----------------------------------------------------------------|-------------------------------------------------------------------|-------------------------------------------------------------------|
| [![GitHub release][github-release-badge]][github-release-link] | [![Build Status][build-status-badge]][build-status-link] | [![GitHub license][github-license-badge]][github-license-link] | [![GitHub sponsors][github-sponsors-badge]][github-sponsors-link] | [![Buy Me a Coffee][buy-me-a-coffee-badge]][buy-me-a-coffee-link] |

<!-- prettier-ignore-end -->

<!-- Badges -->

[github-release-badge]: https://img.shields.io/github/v/release/NERDHEAD-lab/POE2-KG-Client-Patch-Butler?logo=github
[build-status-badge]: https://github.com/NERDHEAD-lab/POE2-KG-Client-Patch-Butler/actions/workflows/release-please.yml/badge.svg
[github-license-badge]: https://img.shields.io/github/license/NERDHEAD-lab/POE2-KG-Client-Patch-Butler
[github-sponsors-badge]: https://img.shields.io/github/sponsors/NERDHEAD-lab?logo=github&logoColor=white
[buy-me-a-coffee-badge]: https://img.shields.io/badge/Buy%20Me%20a%20Coffee-yellow?logo=buymeacoffee&logoColor=white

<!-- Links -->

[github-release-link]: https://github.com/NERDHEAD-lab/POE2-KG-Client-Patch-Butler/releases
[build-status-link]: https://github.com/NERDHEAD-lab/POE2-KG-Client-Patch-Butler/actions
[github-license-link]: https://github.com/NERDHEAD-lab/POE2-KG-Client-Patch-Butler/blob/master/LICENSE
[github-sponsors-link]: https://github.com/sponsors/NERDHEAD-lab
[buy-me-a-coffee-link]: https://coff.ee/nerdhead_lab


# POE2 KG Client Patch Butler

![Demo](docs/poe2%20patch%20성공.gif)

Kakao Games의 Path of Exile 2 클라이언트 패치 실패 문제를 해결하기 위한 도구입니다.

## 기능

- **안전한 다운로드**: 임시 폴더(`.patch_temp`)를 사용하여 다운로드 중 오류가 발생해도 원본 클라이언트를 보호합니다.
- **자동 경로 탐지**: 레지스트리 및 저장된 설정을 통해 설치 경로를 자동으로 찾습니다.
- **로그 분석**: `KakaoClient.txt` 로그를 분석하여 다운로드에 실패한 파일을 자동으로 식별합니다.
- **자동 다운로드 & 복구**: 식별된 파일을 다운로드하고 설치 경로에 안전하게 복구합니다.
- **안정성 (New)**: 서버 연결 끊김(Abort) 방지를 위한 동시성 제어 및 자동 재시도 기능을 제공합니다.
- **임시 파일 관리**: 작업 완료 후 임시 폴더의 삭제 또는 보존 여부를 선택할 수 있습니다.

## 사용 방법

1. [Releases](https://github.com/NERDHEAD-lab/POE2-KG-Client-Patch-Butler/releases) 페이지에서 최신 `poe2-patch-butler.exe` 파일을 다운로드합니다.
2. 실행 (`Enter`로 진행):
   - 설치 경로를 자동으로 찾습니다. 맞으면 `Enter`.
   - 로그를 분석하여 복구할 팔일을 찾습니다. 맞으면 `Enter`.
3. 다운로드 및 복구:
   - 자동으로 다운로드가 진행됩니다.
4. 완료 및 정리:
   - 작업 완료 후 임시 폴더를 삭제(`Enter`)하거나 보존(`Q`)할 수 있습니다. (성공 시 `Enter` 권장)
   - 프로그램 종료 후 **공식 홈페이지**에서 게임을 다시 시작하세요.

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

[MIT](LICENSE)
