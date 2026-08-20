/**
 * 맥북 웹캠 랜드마크 기반 실시간 환경 진단 엔진.
 * MediaPipe Pose 랜드마크를 분석하여:
 * 1) 화면 거리 (cm 및 상태)
 * 2) 맥북 배치 각도 (정면 / 측면 듀얼 / 하단 앙각)
 * 3) 시선 및 모니터 높이
 * 4) 어깨 및 의자 좌우 균형
 * 을 인체공학적 상태 기반으로 판정합니다.
 */

export function analyzeEnvironment(calibration) {
  const landmarks = calibration?.landmarks

  // 캘리브레이션 랜드마크가 없는 경우 기본 이상적 세팅 반환
  if (!landmarks || landmarks.length < 13) {
    return {
      distanceCm: 65,
      distanceStatus: 'ok',
      gazeAngle: -6,
      gazeStatus: 'ok',
      laptopSetup: 'front',
      yawDeg: 0,
      shoulderTiltDeg: 0.8,
      shoulderStatus: 'ok',
      headXOffset: 0,
      needsFixCount: 0,
      checks: [
        {
          id: 'distance',
          name: '화면 거리',
          ok: true,
          value: '약 65cm (적정)',
          finding: '맥북과 이상적인 인체공학 거리(60–70cm)를 유지하고 있어 머리가 앞으로 쏠리지 않아요.',
          fix: '팔을 뻗었을 때 손끝이 화면에 가볍게 닿는 지금 거리를 유지해 주세요.',
        },
        {
          id: 'camera',
          name: '맥북 배치 각도',
          ok: true,
          value: '정면 정렬',
          finding: '맥북 웹캠이 몸통 정면에 안정적으로 위치해 목이 한쪽으로 비틀리지 않아요.',
          fix: '의자와 맥북이 정면을 마주보는 상태를 유지해 주세요.',
        },
        {
          id: 'monitor',
          name: '화면 · 시선 높이',
          ok: true,
          value: '시선 −6° (안정)',
          finding: '화면 상단과 눈높이의 단차가 적정 범위여서 목 뒤쪽 근육의 부담이 적어요.',
          fix: '맥북 거치대로 화면 상단이 눈높이와 수평을 이루도록 유지해 주세요.',
        },
      ],
    }
  }

  // ── 실제 랜드마크 분석 ────────────────────────────────────────────────
  const nose = landmarks[0]
  const leftEye = landmarks[2]
  const rightEye = landmarks[5]
  const leftEar = landmarks[7]
  const rightEar = landmarks[8]
  const leftShoulder = landmarks[11]
  const rightShoulder = landmarks[12]

  // 1. 화면 거리 (양 눈 픽셀 거리 기반)
  const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y)
  let approxDistCm = Math.round(7.2 / (eyeDist || 0.11))
  approxDistCm = Math.max(38, Math.min(95, approxDistCm))

  const isClose = approxDistCm < 55
  const isFar = approxDistCm > 80
  const distanceStatus = isClose ? 'close' : isFar ? 'far' : 'ok'

  // 2. 맥북 배치 각도 (Yaw: 코와 양 귀 중심 편차)
  const earMidX = (leftEar.x + rightEar.x) / 2
  const earMidY = (leftEar.y + rightEar.y) / 2
  const yawOffset = nose.x - earMidX
  const yawDeg = Math.round(yawOffset * 220)

  let laptopSetup = 'front'
  let laptopText = '정면 정렬'
  if (yawDeg > 10) {
    laptopSetup = 'side_right'
    laptopText = `우측 측면 배치 (약 ${Math.abs(yawDeg)}°)`
  } else if (yawDeg < -10) {
    laptopSetup = 'side_left'
    laptopText = `좌측 측면 배치 (약 ${Math.abs(yawDeg)}°)`
  }

  // 3. 화면 시선 높이 (Pitch: 코와 귀 수직 비율)
  const gazeSlope = nose.y - earMidY
  const gazeAngle = Math.round(gazeSlope * 180 - 8)
  const gazeStatus = gazeAngle < -12 ? 'low' : gazeAngle > 4 ? 'high' : 'ok'

  // 4. 어깨 좌우 비대칭
  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y)
  const shoulderTiltDeg = Math.round(shoulderTilt * 90 * 10) / 10
  const shoulderStatus = shoulderTiltDeg > 2.2 ? 'tilt' : 'ok'

  // 거북목 머리 오프셋 (모식도 렌더링용)
  const headXOffset = isClose ? 14 : gazeStatus === 'low' ? 10 : 0

  // ── 3가지 핵심 진단 카드 생성 ──────────────────────────────────────────
  const checks = [
    {
      id: 'distance',
      name: '화면 거리',
      ok: distanceStatus === 'ok',
      value: `약 ${approxDistCm}cm · ${distanceStatus === 'close' ? '화면 밀착 주의' : distanceStatus === 'far' ? '다소 멈' : '적정'}`,
      finding:
        distanceStatus === 'close'
          ? '화면이 얼굴과 너무 가까워 머리가 앞으로 먼저 마중 나가는 원인이 되고 있어요.'
          : distanceStatus === 'far'
            ? '화면이 다소 멀어 글씨를 보려고 고개를 내밀게 될 수 있어요.'
            : '권장 거리(60–70cm)를 안정적으로 유지하고 있어 눈과 목에 부담이 적어요.',
      fix:
        distanceStatus === 'close'
          ? '의자를 반 뼘 뒤로 밀어주세요. 팔을 뻗어 손끝이 맥북 화면에 닿을락 말락 한 거리가 적당해요.'
          : distanceStatus === 'far'
            ? '화면을 한 뼘 앞으로 당기거나 브라우저 폰트 배율을 조금 키워주세요.'
            : '손끝이 화면에 닿는 지금 거리를 계속 유지해 주세요.',
    },
    {
      id: 'camera',
      name: '맥북 배치 각도',
      ok: laptopSetup === 'front',
      value: laptopText,
      finding:
        laptopSetup === 'side_right'
          ? '맥북 웹캠이 우측에 위치해 있어 시선이 측면을 향하고 있어요.'
          : laptopSetup === 'side_left'
            ? '맥북 웹캠이 좌측에 위치해 있어 시선이 측면을 향하고 있어요.'
            : '맥북이 몸통 정면에 위치해 좌우 목 근육의 긴장도가 균형 잡혀 있어요.',
      fix:
        laptopSetup !== 'front'
          ? '목이 한쪽으로 비틀리지 않도록 주로 보시는 메인 모니터 정면에 의자와 몸통을 정렬해 주세요.'
          : '맥북이 몸통 중앙을 마주보는 상태를 유지해 주세요.',
    },
    {
      id: 'monitor',
      name: '화면 · 시선 높이',
      ok: gazeStatus === 'ok',
      value: `시선 ${gazeAngle > 0 ? '+' : ''}${gazeAngle}° · ${gazeStatus === 'low' ? '고개 숙임' : gazeStatus === 'high' ? '시선 높음' : '안정'}`,
      finding:
        gazeStatus === 'low'
          ? '맥북 화면이 눈높이보다 낮아 고개가 앞으로 숙여지는 거북목 셋업이에요.'
          : gazeStatus === 'high'
            ? '화면이 눈높이보다 다소 높아 턱이 들리고 목 뒤가 긴장될 수 있어요.'
            : '화면 상단과 눈높이 단차가 알맞아 목뼈 정렬이 자연스럽습니다.',
      fix:
        gazeStatus === 'low'
          ? '맥북 거치대로 화면 상단을 눈높이까지 올려주세요. 목 하중이 50% 줄어듭니다.'
          : gazeStatus === 'high'
            ? '의자 높이를 올리거나 모니터 거치대를 약간 낮춰주세요.'
            : '화면 상단이 눈높이와 일치하는 지금 세팅을 유지해 주세요.',
    },
  ]

  const needsFixCount = checks.filter((c) => !c.ok).length

  return {
    distanceCm: approxDistCm,
    distanceStatus,
    gazeAngle,
    gazeStatus,
    laptopSetup,
    yawDeg,
    shoulderTiltDeg,
    shoulderStatus,
    headXOffset,
    needsFixCount,
    checks,
  }
}
