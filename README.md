# 보스의 던전 나들이

OpenAI Game Builders Seoul Track 1 제출용 웹 게임 프로토타입입니다.

## 실행

브라우저에서 `index.html`을 열거나 정적 서버로 실행합니다.

```sh
python3 -m http.server 5173
```

Godot 프로토타입은 `godot/` 폴더에 있습니다.

```sh
/Applications/Godot.app/Contents/MacOS/Godot --editor --path godot
```

## 조작

- WASD/방향키: 이동
- Q: 휘두르기
- E: 돌진
- R: 포효

## 심사용 설명

- 재밌는 게임 코어: 타일형 던전에서 용사 파티의 목표를 보고 사냥 순서를 정한 뒤, 방 단위 2D 핵앤슬래시 전투로 파티를 제압하는 역방향 던전 크롤러
- 제약 없는 플레이: 정적 웹 빌드라 설치와 로그인 없이 실행 가능
- Codex 활용: Codex로 MVP 기획 검토, 최소 구현 범위 선정, 게임 루프 구현, UI/조작 안내 작성

## Godot 방향

- 1인칭 픽셀/로우폴리 던전
- 자동 전진 기반 일직선 조우 진행
- 보스 자동공격
- 단일 용사 처치 후 던전 자원 회수
- 전투 후 전리품 흡수 3택

사용 에셋:

- Kenney Modular Dungeon Kit, CC0
