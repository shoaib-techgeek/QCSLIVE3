import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import Badge from './Badge.jsx'
import Button from './Button.jsx'
import DataTable from './DataTable.jsx'
import Modal from './Modal.jsx'
import ProductCard from './ProductCard.jsx'
import Tabs from './Tabs.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import { ToastProvider, useToast } from './Toast.jsx'
import { useState } from 'react'

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
  localStorage.clear()
})

describe('Button', () => {
  it('disables itself and marks busy while loading', () => {
    render(<Button loading>Publish</Button>)
    const b = screen.getByRole('button', { name: 'Publish' })
    expect(b).toBeDisabled()
    expect(b).toHaveAttribute('aria-busy', 'true')
  })
  it('renders a link when given `to`', () => {
    render(<MemoryRouter><Button to="/x">Go</Button></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/x')
  })
})

describe('Badge', () => {
  it('carries text so status is not colour-only', () => {
    render(<Badge tone="danger">Rejected</Badge>)
    expect(screen.getByText('Rejected')).toHaveClass('badge-danger')
  })
})

describe('Tabs', () => {
  function Demo() {
    const [v, setV] = useState('a')
    return <Tabs label="Demo" value={v} onChange={setV} tabs={[{ id: 'a', label: 'A', panel: 'Panel A' }, { id: 'b', label: 'B', panel: 'Panel B' }]} />
  }
  it('moves selection with arrow keys', async () => {
    render(<Demo />)
    const user = userEvent.setup()
    screen.getByRole('tab', { name: 'A' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel B')
  })
})

describe('Modal', () => {
  it('renders its title and actions when open and calls onClose on cancel', () => {
    let closed = 0
    render(<Modal open onClose={() => closed++} title="Delete?" actions={<button>Yes</button>}>Body</Modal>)
    expect(screen.getByRole('heading', { name: 'Delete?' })).toBeInTheDocument()
    act(() => { screen.getByRole('dialog', { hidden: true }).dispatchEvent(new Event('cancel', { cancelable: true })) })
    expect(closed).toBe(1)
  })
})

describe('Toast', () => {
  function Demo() {
    const toast = useToast()
    return <button onClick={() => toast.success('Product published')}>go</button>
  }
  it('announces a message and can be dismissed', async () => {
    render(<ToastProvider><Demo /></ToastProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByText('go'))
    expect(screen.getByText('Product published')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.queryByText('Product published')).not.toBeInTheDocument()
  })
})

describe('ThemeToggle', () => {
  it('applies and persists the chosen theme, and clears it for system', async () => {
    render(<ThemeToggle />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Dark theme' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem('qcs-theme')).toBe('dark')
    await user.click(screen.getByRole('button', { name: 'Match system theme' }))
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })
})

describe('ProductCard', () => {
  it('shows price, the discount and one link for the card', () => {
    render(<MemoryRouter><ProductCard title="Linen shirt" to="/p/1" priceMinor={300000} wasMinor={400000} /></MemoryRouter>)
    expect(screen.getByText('25% off')).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })
})

describe('DataTable', () => {
  it('renders headers and rows with a named region', () => {
    render(<DataTable caption="Orders" rows={[{ id: 1, n: 'x' }]} columns={[{ key: 'n', header: 'Name' }]} />)
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Orders' })).toBeInTheDocument()
  })
})
