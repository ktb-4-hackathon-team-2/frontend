/**
 * 노트북 웹캠 랜드마크 & 사용자 선택 기반 실시간 환경 진단 엔진.
 * 1) 노트북 배치 (정면 / 우측 측면 / 좌측 측면 ➔ 모두 정상적인 작업 셋업으로 인정)
 * 2) 화면 및 시선 높이 (측면 앵글 시선 왜곡 자동 보정 + 고개 숙임 정밀 감지)
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

    // 사용자가 명시적으로 선택하지 않은 기본 상태일 때만 자동 감지 적용
    if (!overrideView || overrideView === 'auto') {
      if (yawDeg > 14) {
        laptopSetup = 'side_right'
      } else if (yawDeg < -14) {
        laptopSetup = 'side_left'
      } else {
        laptopSetup = 'front'
      }
    }
  }

  const isSideRight = laptopSetup === 'side_right'
  const isSideLeft = laptopSetup === 'side_left'
  const isSide = isSideRight || isSideLeft

  if (isSideRight) {
    laptopText = yawDeg !== 0 ? `우측 측면 배치 (약 ${Math.abs(yawDeg)}°)` : '우측 측면 배치'
  } else if (isSideLeft) {
    laptopText = yawDeg !== 0 ? `좌측 측면 배치 (약 ${Math.abs(yawDeg)}°)` : '좌측 측면 배치'
  } else {
    laptopText = '정면 정렬'
  }

  // 2. 화면 및 시선 높이 정밀 계산 (측면 앵글 적응형 기하 보정)
  let gazeAngle = -4
  let gazeStatus = 'ok'
  let headXOffset = 0

  if (landmarks && landmarks.length >= 13) {
    const nose = landmarks[0]
    const leftEar = landmarks[7]
    const rightEar = landmarks[8]
    const leftShoulder = landmarks[11]
    const rightShoulder = landmarks[12]

    // 측면 촬영 시 반대편 귀 가려짐(Self-Occlusion) 방지: 카메라에 가까운 기준 귀 선택
    const nearEar = isSideRight ? rightEar : isSideLeft ? leftEar : null
    const farEar = isSideRight ? leftEar : isSideLeft ? rightEar : null

    // 귀 중심 y좌표 (가려진 귀의 신뢰도가 낮으면 nearEar 가중치 강화)
    let earRefY
    if (nearEar && farEar) {
      const nearVis = nearEar.visibility ?? 1
      const farVis = farEar.visibility ?? 1
      if (nearVis > farVis + 0.2) {
        earRefY = nearEar.y * 0.75 + farEar.y * 0.25
      } else {
        earRefY = (nearEar.y + farEar.y) / 2
      }
    } else {
      earRefY = (leftEar.y + rightEar.y) / 2
    }

    const earDelta = nose.y - earRefY

    // 어깨 중심선 및 어깨 너비 (측면 투영 시 단축 왜곡 보정)
    const scY = (leftShoulder.y + rightShoulder.y) / 2
    const rawSw = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y) || 0.35
    const sw = isSide ? rawSw * 1.18 : rawSw // 측면 뷰일 때 투영 축소 보정
    const headDownRatio = (scY - nose.y) / sw

    // 측면/정면 맞춤 굴곡각 계산
    const headDownDrop = Math.max(0, 0.58 - headDownRatio)
    const flexionFactor = (earDelta * (isSide ? 140 : 160)) + (headDownDrop * 35)

    // 시선 각도 산출
    gazeAngle = Math.round(-flexionFactor - 3)

    // 인체공학 판정 (측면에서는 ±14°까지 자연스러운 듀얼 모니터 시선 이동으로 수용)
    const lowThreshold = isSide ? -15 : -13
    const highThreshold = isSide ? 6 : 5

    if (gazeAngle <= lowThreshold) {
      gazeStatus = 'low'
      headXOffset = 12
    } else if (gazeAngle >= highThreshold) {
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
      ok: true, // 정면/측면 듀얼 모두 정상적인 데스크 셋업으로 인정 (적정 🟢)
      statusText: laptopSetup === 'front' ? '적정' : '적정 (측면 셋업)',
      value: laptopText,
      setupKey: laptopSetup,
      finding:
        laptopSetup === 'side_right'
          ? '노트북을 오른쪽에 둔 듀얼 모니터 환경이에요. 반듯 AI가 측면 앵글을 감안해 자세를 정밀하게 분석합니다.'
          : laptopSetup === 'side_left'
            ? '노트북을 왼쪽에 둔 듀얼 모니터 환경이에요. 반듯 AI가 측면 앵글을 감안해 자세를 정밀하게 분석합니다.'
            : '노트북이 몸통 정면에 위치해 좌우 목 근육의 긴장도가 균형 잡혀 있어요.',
      fix:
        laptopSetup !== 'front'
          ? '목이 한쪽으로만 오래 비틀리지 않도록 주로 보시는 메인 모니터 정면에 의자와 몸통을 정렬해 주세요.'
          : '노트북이 몸통 중앙을 마주보는 상태를 유지해 주세요.',
    },
    {
      id: 'monitor',
      name: '화면 · 시선 높이',
      ok: gazeStatus === 'ok',
      statusText: gazeStatus === 'ok' ? '적정' : '조정 필요',
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

  // 실제 물리적 교정이 필요한 항목(모니터 높이 등)만 조정 필요 카운트에 반영
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
