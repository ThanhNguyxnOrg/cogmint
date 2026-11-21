import { render, screen } from '@testing-library/react'
import App from './App'

test('App renders COGMINT shell landmark without Tauri runtime', () => {
  render(<App />)
  expect(screen.getByRole('main', { name: /COGMINT/i })).toBeInTheDocument()
  expect(screen.getByText('COGMINT')).toBeInTheDocument()
})
