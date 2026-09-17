"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** The legacy order form's shipping-country list, in its order; stored as full names in orders.ship_country. */
export const SHIPPING_COUNTRIES: readonly string[] = [
  'Argentina', 'Australia', 'Austria', 'Belgium', 'Brazil', 'Canada', 'Czech Republic', 'China',
  'Denmark', 'Finland', 'France', 'Germany', 'Italy', 'Israel', 'India', 'Japan', 'Mexico',
  'Netherlands', 'New Zealand', 'Norway', 'Portugal', 'Republic of Ireland', 'Romania', 'Russia',
  'South Africa', 'Spain', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom', 'United States',
];

export const US_STATES: readonly string[] = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah',
  'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
];

const UNITED_STATES = 'United States';

interface Props {
  country: string;
  state: string;
  onCountryChange: (country: string) => void;
  onStateChange: (state: string) => void;
  idPrefix?: string;
}

/** Legacy shipping Country select (+ US State select), shared by the Create and Edit order forms. */
export function ShippingCountrySelect({ country, state, onCountryChange, onStateChange, idPrefix = 'ship' }: Props) {
  // Legacy DB stores "-1" as a sentinel for an unset country.
  const value = country && country !== '-1' ? country : '';
  return (
    <>
      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
        <Label htmlFor={`${idPrefix}-country`} className="text-sm font-medium">Country:</Label>
        <Select value={value} onValueChange={onCountryChange}>
          <SelectTrigger id={`${idPrefix}-country`} className="h-9">
            <SelectValue placeholder="- Choose -" />
          </SelectTrigger>
          <SelectContent>
            {SHIPPING_COUNTRIES.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {value === UNITED_STATES && (
        <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
          <Label htmlFor={`${idPrefix}-state`} className="text-sm font-medium">State:</Label>
          <Select value={state} onValueChange={onStateChange}>
            <SelectTrigger id={`${idPrefix}-state`} className="h-9">
              <SelectValue placeholder="- Choose -" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}
