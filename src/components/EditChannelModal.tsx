import { SalesChannel, SalesChannelPeriod } from '../types';

interface EditChannelModalProps {
  channel: SalesChannel;
  onChange: (channel: SalesChannel) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function EditChannelModal({ channel, onChange, onSave, onCancel }: EditChannelModalProps) {
  const addPeriod = () => {
    onChange({
      ...channel,
      periods: [
        ...channel.periods,
        {
          id: `p${Date.now()}`,
          start: '',
          end: '',
          pricing: { adult: 0, child: 0, infant: 0 }
        }
      ]
    });
  };

  const updatePeriod = (periodId: string, updates: Partial<SalesChannelPeriod>) => {
    onChange({
      ...channel,
      periods: channel.periods.map(p =>
        p.id === periodId ? { ...p, ...updates } : p
      )
    });
  };

  const removePeriod = (periodId: string) => {
    onChange({
      ...channel,
      periods: channel.periods.filter(p => p.id !== periodId)
    });
  };

  const checkOverlap = () => {
    const periods = channel.periods;
    for (let i = 0; i < periods.length; i++) {
      for (let j = i + 1; j < periods.length; j++) {
        const p1 = periods[i];
        const p2 = periods[j];
        if (p1.start && p1.end && p2.start && p2.end) {
          if (
            (p1.start <= p2.end && p1.end >= p2.start) ||
            (p2.start <= p1.end && p2.end >= p1.start)
          ) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const hasOverlap = checkOverlap();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          {channel.name ? `${channel.name} の編集` : '新規販売リスト'}
        </h3>

        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                リスト名 *
              </label>
              <input
                type="text"
                value={channel.name}
                onChange={(e) => onChange({ ...channel, name: e.target.value })}
                placeholder="例: あいちゃん、ネット予約"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                style={{ minHeight: '44px' }}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                カテゴリ / グループ名（任意）
              </label>
              <input
                type="text"
                value={channel.category}
                onChange={(e) => onChange({ ...channel, category: e.target.value })}
                placeholder="例: ○○旅行社、△△サイト（請求書作成時にまとめて集計）"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                style={{ minHeight: '44px' }}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                同じカテゴリのリストは、レポートや請求書で合算されます
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <h4 className="font-bold text-gray-900 dark:text-white mb-3">通常料金</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              期間別料金が設定されていない日付に適用されます。<br />
              <span className="text-yellow-600 dark:text-yellow-400">
                年間を通して期間別料金のみを使う場合は「0円」に設定してください。
              </span>
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-900 dark:text-white mb-1">大人</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={channel.pricing.adult}
                    onChange={(e) => onChange({
                      ...channel,
                      pricing: { ...channel.pricing, adult: parseInt(e.target.value) || 0 }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    style={{ minHeight: '44px' }}
                  />
                  <span className="text-gray-600 dark:text-gray-400 text-sm">円</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-900 dark:text-white mb-1">子供</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={channel.pricing.child}
                    onChange={(e) => onChange({
                      ...channel,
                      pricing: { ...channel.pricing, child: parseInt(e.target.value) || 0 }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    style={{ minHeight: '44px' }}
                  />
                  <span className="text-gray-600 dark:text-gray-400 text-sm">円</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-900 dark:text-white mb-1">幼児</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={channel.pricing.infant}
                    onChange={(e) => onChange({
                      ...channel,
                      pricing: { ...channel.pricing, infant: parseInt(e.target.value) || 0 }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    style={{ minHeight: '44px' }}
                  />
                  <span className="text-gray-600 dark:text-gray-400 text-sm">円</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-bold text-gray-900 dark:text-white mb-3">販促費（任意）</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              販促費が設定されている場合、乗船管理で自動計算されます。<br />
              設定しない場合は全て「0円」のままにしてください。
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-900 dark:text-white mb-1">大人</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={channel.commission?.adult || 0}
                    onChange={(e) => onChange({
                      ...channel,
                      commission: {
                        adult: parseInt(e.target.value) || 0,
                        child: channel.commission?.child || 0,
                        infant: channel.commission?.infant || 0
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    style={{ minHeight: '44px' }}
                  />
                  <span className="text-gray-600 dark:text-gray-400 text-sm">円</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-900 dark:text-white mb-1">子供</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={channel.commission?.child || 0}
                    onChange={(e) => onChange({
                      ...channel,
                      commission: {
                        adult: channel.commission?.adult || 0,
                        child: parseInt(e.target.value) || 0,
                        infant: channel.commission?.infant || 0
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    style={{ minHeight: '44px' }}
                  />
                  <span className="text-gray-600 dark:text-gray-400 text-sm">円</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-900 dark:text-white mb-1">幼児</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={channel.commission?.infant || 0}
                    onChange={(e) => onChange({
                      ...channel,
                      commission: {
                        adult: channel.commission?.adult || 0,
                        child: channel.commission?.child || 0,
                        infant: parseInt(e.target.value) || 0
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    style={{ minHeight: '44px' }}
                  />
                  <span className="text-gray-600 dark:text-gray-400 text-sm">円</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-gray-900 dark:text-white">期間別料金</h4>
              <button
                onClick={addPeriod}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                style={{ minHeight: '36px' }}
              >
                + 期間追加
              </button>
            </div>

            {hasOverlap && (
              <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 dark:border-yellow-600 text-yellow-800 dark:text-yellow-200 p-3 rounded-lg mb-3">
                <div className="flex items-start gap-2">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <div className="font-bold">期間が重複しています</div>
                    <div className="text-sm">
                      重複する日付では、より短い期間の料金が優先されます。<br />
                      意図しない料金にならないよう、期間を見直してください。
                    </div>
                  </div>
                </div>
              </div>
            )}

            {channel.periods.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                期間別料金が設定されていません
              </p>
            ) : (
              <div className="space-y-3">
                {channel.periods.map(period => (
                  <div key={period.id} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="date"
                        value={period.start}
                        onChange={(e) => updatePeriod(period.id, { start: e.target.value })}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        style={{ minHeight: '44px' }}
                      />
                      <span className="text-gray-600 dark:text-gray-400">〜</span>
                      <input
                        type="date"
                        value={period.end}
                        onChange={(e) => updatePeriod(period.id, { end: e.target.value })}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        style={{ minHeight: '44px' }}
                      />
                      <button
                        onClick={() => removePeriod(period.id)}
                        className="ml-auto text-red-500 hover:text-red-400"
                        style={{ minHeight: '44px', minWidth: '44px' }}
                      >
                        🗑️
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-900 dark:text-white mb-1">大人</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={period.pricing.adult}
                            onChange={(e) => updatePeriod(period.id, {
                              pricing: {
                                ...period.pricing,
                                adult: parseInt(e.target.value) || 0
                              }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                            style={{ minHeight: '44px' }}
                          />
                          <span className="text-gray-600 dark:text-gray-400 text-sm">円</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-900 dark:text-white mb-1">子供</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={period.pricing.child}
                            onChange={(e) => updatePeriod(period.id, {
                              pricing: {
                                ...period.pricing,
                                child: parseInt(e.target.value) || 0
                              }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                            style={{ minHeight: '44px' }}
                          />
                          <span className="text-gray-600 dark:text-gray-400 text-sm">円</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-900 dark:text-white mb-1">幼児</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={period.pricing.infant}
                            onChange={(e) => updatePeriod(period.id, {
                              pricing: {
                                ...period.pricing,
                                infant: parseInt(e.target.value) || 0
                              }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                            style={{ minHeight: '44px' }}
                          />
                          <span className="text-gray-600 dark:text-gray-400 text-sm">円</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            style={{ minHeight: '44px' }}
          >
            キャンセル
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-bold"
            style={{ minHeight: '44px' }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
