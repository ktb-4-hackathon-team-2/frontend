import { ScreenHeader } from '../components/ui'
import { SettingsPanel } from '../components/SettingsPanel'

export default function Settings() {
  return (
    <div className="max-w-3xl">
      <ScreenHeader title="설정" desc="개입은 딱 필요한 만큼만. 나머지는 반듯이 알아서." />
      <SettingsPanel />
    </div>
  )
}
