import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import Home from '../app/page'

it('renders the homepage headline', () => {
  render(<Home />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Something meaningful')
})
