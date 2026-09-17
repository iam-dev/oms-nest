import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShippingCountrySelect, SHIPPING_COUNTRIES, US_STATES } from '@/components/shared/ShippingCountrySelect';

jest.mock('@/components/ui/select', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactActual = require('react') as typeof React;
  const Ctx = ReactActual.createContext(undefined as unknown);
  return {
    Select: ({ children, value, onValueChange }: { children: React.ReactNode; value?: string; onValueChange?: unknown }) => (
      <Ctx.Provider value={onValueChange}><div data-testid="select" data-value={value}>{children}</div></Ctx.Provider>
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => {
      const onChange = ReactActual.useContext(Ctx);
      return <div data-value={value} onClick={() => { if (typeof onChange === 'function') onChange(value); }}>{children}</div>;
    },
  };
});
jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...p }: React.LabelHTMLAttributes<HTMLLabelElement> & { children: React.ReactNode }) => <label {...p}>{children}</label>,
}));

describe('ShippingCountrySelect', () => {
  it('offers the legacy 30 countries in legacy order', () => {
    expect(SHIPPING_COUNTRIES).toHaveLength(30);
    expect(SHIPPING_COUNTRIES[0]).toBe('Argentina');
    expect(SHIPPING_COUNTRIES[29]).toBe('United States');
    expect(SHIPPING_COUNTRIES).toContain('Republic of Ireland');
  });

  it('renders a "- Choose -" placeholder and treats the legacy "-1" sentinel as unset', () => {
    render(<ShippingCountrySelect country="-1" state="" onCountryChange={jest.fn()} onStateChange={jest.fn()} />);
    expect(screen.getAllByText('- Choose -').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('select')[0]).toHaveAttribute('data-value', '');
  });

  it('only shows the State select for United States', () => {
    const { rerender } = render(<ShippingCountrySelect country="Germany" state="" onCountryChange={jest.fn()} onStateChange={jest.fn()} />);
    expect(screen.queryByText('State:')).not.toBeInTheDocument();
    rerender(<ShippingCountrySelect country="United States" state="Alaska" onCountryChange={jest.fn()} onStateChange={jest.fn()} />);
    expect(screen.getByText('State:')).toBeInTheDocument();
    expect(US_STATES).toContain('South Carolina');
  });

  it('reports changes', () => {
    const onCountryChange = jest.fn();
    render(<ShippingCountrySelect country="" state="" onCountryChange={onCountryChange} onStateChange={jest.fn()} />);
    fireEvent.click(screen.getByText('Netherlands'));
    expect(onCountryChange).toHaveBeenCalledWith('Netherlands');
  });

  it('clears a previously saved country by choosing "- Choose -"', () => {
    const onCountryChange = jest.fn();
    const { container } = render(
      <ShippingCountrySelect country="Germany" state="" onCountryChange={onCountryChange} onStateChange={jest.fn()} />
    );
    const chooseItem = container.querySelector('[data-value="-1"]');
    expect(chooseItem).not.toBeNull();
    fireEvent.click(chooseItem as Element);
    expect(onCountryChange).toHaveBeenCalledWith('');
  });
});
