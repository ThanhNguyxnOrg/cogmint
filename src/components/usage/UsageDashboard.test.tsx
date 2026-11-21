import { render, screen } from '@testing-library/react'
import { UsageDashboard } from './UsageDashboard'

test('UsageDashboard renders empty state with zero mock figures when total_cost_usd is 0 and by_day is empty', () => {
  render(
    <UsageDashboard
      summary={{
        totalCostUsd: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
        totalCacheWriteTokens: 0,
        byHarness: [],
        byModel: [],
        byDay: [],
        pricingUpdatedAt: '2026-11-21T00:00:00Z',
      }}
      onReload={() => {}}
      onBack={() => {}}
    />,
  )

  expect(screen.getByText(/No local usage recorded yet/i)).toBeInTheDocument()
  expect(screen.queryByText(/30D Total Spend/i)).not.toBeInTheDocument()
})
