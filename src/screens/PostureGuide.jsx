import { Card, Icon, ScreenHeader } from '../components/ui'

// 바른 자세 설명 화면 — 캘리브레이션의 '캡처 전에, 바른 자세부터' 가이드를
// 상시 볼 수 있게 분리한 단순 설명형 화면. 내용은 추후 채운다.
export default function PostureGuide() {
  return (
    <div>
      <ScreenHeader title="바른 자세란?" desc="모니터링이 기준으로 삼는 좋은 앉은 자세를 설명해요." />
      <Card className="rise p-12 text-center">
        <Icon name="target" size={32} className="mx-auto mb-3 text-dim" />
        <p className="text-sm text-mid">내용 준비 중이에요.</p>
        <p className="mt-1 text-xs text-dim">
          캘리브레이션의 &lsquo;캡처 전에, 바른 자세부터&rsquo; 가이드를 바탕으로 채워질 예정이에요.
        </p>
      </Card>
    </div>
  )
}
