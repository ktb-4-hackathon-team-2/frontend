// Document Picture-in-Picture — 다른 앱 위에 떠 있는 플로팅 위젯 창.
// Chrome 계열 전용 API라 지원 여부를 확인해 옵션 기능으로만 노출한다.
// (미지원 브라우저에서는 버튼 자체가 숨겨지고 앱은 동일하게 동작)

export const pipSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window

/** 메인 문서의 스타일시트를 PiP 창으로 복사한다 (Tailwind 포함) */
export function copyStylesTo(pipWindow) {
  for (const sheet of [...document.styleSheets]) {
    try {
      const css = [...sheet.cssRules].map((rule) => rule.cssText).join('')
      const style = pipWindow.document.createElement('style')
      style.textContent = css
      pipWindow.document.head.appendChild(style)
    } catch {
      // 크로스 오리진 시트(폰트 등)는 link 로 복사
      if (sheet.href) {
        const link = pipWindow.document.createElement('link')
        link.rel = 'stylesheet'
        link.href = sheet.href
        pipWindow.document.head.appendChild(link)
      }
    }
  }
}

/** 플로팅 위젯 창 열기 — 사용자 제스처(클릭) 안에서만 호출 가능 */
export async function openPipWindow({ width = 240, height = 170 } = {}) {
  const pipWindow = await window.documentPictureInPicture.requestWindow({ width, height })
  copyStylesTo(pipWindow)
  pipWindow.document.title = '반듯 위젯'
  pipWindow.document.body.style.margin = '0'
  pipWindow.document.body.style.background = '#0b0d0e'
  return pipWindow
}
