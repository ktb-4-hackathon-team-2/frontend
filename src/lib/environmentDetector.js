/**
 * 노트북 웹캠 랜드마크 & 사용자 선택 기반 실시간 환경 진단 엔진.
 * 1) 노트북 배치 (정면 / 우측 측면 / 좌측 측면)
 * 2) 화면 및 시선 높이 (고개 숙임 / 적정 / 거치대 권장)
 * 를 인체공학적 상태 기반으로 정밀하게 판정합니다.
 */

export function analyzeEnvironment(calibration, overrideView = null) {
  const landmarks = calibration?.landmarks

  // 1. 노트북 배치 결정 (사용자 선택 우선 or 랜드마크 Yaw 각도 분석)
  let laptopSetup = overrideView || 'front'
  let laptopText = '정면 정렬'
  let yawDeg = 0

  if (landmarks && landmarks.length >= 13) {
    const nose = landmarks[0]
    const leftEar = landmarks[7]
    const rightEar = landmarks[8]
    const earMidX = (leftEar.x + rightEar.x) / 2
    const yawOffset = nose.x - earMidX
    yawDeg = Math.round(yawOffset * 220)

    if (!overrideView) {
      if (yawDeg > 8) {
        laptopSetup = 'side_right'
      } else if (yawDeg < -8) {
        laptopSetup = 'side_left'
      }
    }
  }

  if (laptopSetup === 'side_right') {
    laptopText = yawDeg !== 0 ? `우측 측면 배치 (약 ${Math.abs(yawDeg)}°)` : '우측 측면 배치'
  } else if (laptopSetup === 'side_left') {
    laptopText = yawDeg !== 0 ? `좌측 측면 배치 (약 ${Math.abs(yawDeg)}°)` : '좌측 측면 배치'
  } else {
    laptopText = '정면 정렬'
  }

  // 2. 화면 및 시선 높이 정밀 계산 (복합 생체역학 지표)
  let gazeAngle = -6
  let gazeStatus = 'ok'
  let headXOffset = 0

  if (landmarks && landmarks.length >= 13) {
    const nose = landmarks[0]
    const leftEar = landmarks[7]
    const rightEar = landmarks[8]
    const leftShoulder = landmarks[11]
    const rightShoulder = landmarks[12]

    // 1) 코-양귀 수직 편차 (고개 숙임 시 귀가 올라가고 코가 내려감)
    const earMidY = (leftEar.y + rightEar.y) / 2
    const earDelta = nose.y - earMidY

    // 2) 어깨선 대비 코 높이 비율 (어깨 너비 정규화)
    const scY = (leftShoulder.y + rightShoulder.y) / 2
    const sw = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y) || 0.35
    const headDownRatio = (scY - nose.y) / sw // 바른자세: ~0.70, 고개숙임: <0.58

    // 3) 복합 굴곡각 (Flexion Angle)
    // headDownRatio가 0.68 이하로 떨어지거나 earDelta가 0.02 이상이면 고개 숙임 발생
    const headDownDrop = Math.max(0, 0.68 - headDownRatio)
    const flexionFactor = (earDelta * 280) + (headDownDrop * 55)

    // 시선 각도 산출 (-5° ~ -7°: 이상적, -10° 이하: 고개 숙임)
    gazeAngle = Math.round(-flexionFactor - 5)

    // 판정 임계치: -10° 이하이면 고개 숙임(조정 필요), +3° 이상이면 시선 너무 높음
    if (gazeAngle <= -10) {
      gazeStatus = 'low'
      headXOffset = 12
    } else if (gazeAngle >= 4) {
      gazeStatus = 'high'
      headXOffset = 0
    } else {
      gazeStatus = 'ok'
      headXOffset = 0
    }
  }

  // ── 2가지 핵심 진단 카드 생성 ──────────────────────────────────────────
  const checks = [
    {
      id: 'camera',
      name: '노트북 배치',
      ok: laptopSetup === 'front',
      value: laptopText,
      setupKey: laptopSetup,
      finding:
        laptopSetup === 'side_right'
          ? '노트북 웹캠이 우측에 위치해 있어 시선이 측면을 향하고 있어요.'
          : laptopSetup === 'side_left'
            ? '노트북 웹캠이 좌측에 위치해 있어 시선이 측면을 향하고 있어요.'
            : '노트북이 몸통 정면에 위치해 좌우 목 근육의 긴장도가 균형 잡혀 있어요.',
      fix:
        laptopSetup !== 'front'
          ? '목이 한쪽으로 비틀리지 않도록 주로 보시는 메인 모니터 정면에 의자와 몸통을 정렬해 주세요.'
          : '노트북이 몸통 중앙을 마주보는 상태를 유지해 주세요.',
    },
    {
      id: 'monitor',
      name: '화면 · 시선 높이',
      ok: gazeStatus === 'ok',
      value: `시선 ${gazeAngle > 0 ? '+' : ''}${gazeAngle}° · ${gazeStatus === 'low' ? '고개 숙임' : gazeStatus === 'high' ? '시선 높음' : '안정'}`,
      finding:
        gazeStatus === 'low'
          ? '노트북 화면이 눈높이보다 낮아 고개가 앞으로 숙여지는 거북목 셋업이에요.'
          : gazeStatus === 'high'
            ? '화면이 눈높이보다 다소 높아 턱이 들리고 목 뒤가 긴장될 수 있어요.'
            : '화면 상단과 눈높이 단차가 알맞아 목뼈 정렬이 자연스럽습니다.',
      fix:
        gazeStatus === 'low'
          ? '노트북 거치대로 화면 상단을 눈높이까지 10~15cm 올려주세요. 목 하중이 50% 줄어듭니다.'
          : gazeStatus === 'high'
            ? '의자 높이를 올리거나 거치대를 약간 낮춰주세요.'
            : '화면 상단이 눈높이와 일치하는 지금 세팅을 유지해 주세요.',
    },
  ]

  const needsFixCount = checks.filter((c) => !c.ok).length

  return {
    gazeAngle,
    gazeStatus,
    laptopSetup,
    headXOffset,
    needsFixCount,
    checks,
  }
}
